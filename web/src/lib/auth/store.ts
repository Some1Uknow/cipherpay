import "server-only";

import crypto from "crypto";

import { getDb } from "@/lib/db";
import { getServerConfig } from "@/lib/server-config";

export type AuthNonceRecord = {
  id: string;
  wallet_address: string;
  nonce: string;
  ip_hash: string | null;
  user_agent_hash: string | null;
  issued_at: Date;
  expires_at: Date;
  consumed_at: Date | null;
};

export type SessionUserRecord = {
  userId: string;
  walletAddress: string;
  displayName: string | null;
  sessionId: string;
  expiresAt: string;
};

const CHALLENGE_LIMIT_WINDOW_MINUTES = 10;
const MAX_CHALLENGES_PER_WALLET_WINDOW = 5;
const MAX_CHALLENGES_PER_IP_WINDOW = 20;
const MAX_VERIFY_ATTEMPTS_PER_WALLET_WINDOW = 10;

export class AuthRateLimitError extends Error {
  readonly retryAfterSeconds: number;

  constructor(message: string, retryAfterSeconds: number) {
    super(message);
    this.name = "AuthRateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

const getWindowStart = (): Date => {
  const now = new Date();
  now.setMinutes(now.getMinutes() - CHALLENGE_LIMIT_WINDOW_MINUTES);
  return now;
};

export const createNonceValue = (): string => {
  return crypto.randomBytes(18).toString("base64url");
};

export const getSiwsExpiryDate = (issuedAt: Date): Date => {
  const serverConfig = getServerConfig();
  const expiresAt = new Date(issuedAt);
  expiresAt.setMinutes(expiresAt.getMinutes() + serverConfig.siwsNonceTtlMinutes);
  return expiresAt;
};

export const assertChallengeRateLimit = async (walletAddress: string, ipHash: string | null): Promise<void> => {
  const db = getDb();
  const windowStart = getWindowStart().toISOString();
  const walletResult = await db.query<{ count: string }>(
    `
      select count(*)::text as count
      from auth_nonces
      where wallet_address = $1
        and created_at >= $2::timestamptz
    `,
    [walletAddress, windowStart],
  );

  if (Number(walletResult.rows[0]?.count ?? "0") >= MAX_CHALLENGES_PER_WALLET_WINDOW) {
    throw new AuthRateLimitError("Too many wallet challenge requests. Wait and try again.", 600);
  }

  if (ipHash) {
    const ipResult = await db.query<{ count: string }>(
      `
        select count(*)::text as count
        from auth_nonces
        where ip_hash = $1
          and created_at >= $2::timestamptz
      `,
      [ipHash, windowStart],
    );

    if (Number(ipResult.rows[0]?.count ?? "0") >= MAX_CHALLENGES_PER_IP_WINDOW) {
      throw new AuthRateLimitError("Too many challenge requests from this network. Wait and try again.", 600);
    }
  }
};

export const assertVerifyRateLimit = async (walletAddress: string): Promise<void> => {
  const db = getDb();
  const windowStart = getWindowStart().toISOString();
  const result = await db.query<{ count: string }>(
    `
      select count(*)::text as count
      from auth_nonces
      where wallet_address = $1
        and consumed_at is not null
        and created_at >= $2::timestamptz
    `,
    [walletAddress, windowStart],
  );

  if (Number(result.rows[0]?.count ?? "0") >= MAX_VERIFY_ATTEMPTS_PER_WALLET_WINDOW) {
    throw new AuthRateLimitError("Too many verification attempts. Request a new challenge later.", 600);
  }
};

export const insertAuthNonce = async (params: {
  walletAddress: string;
  nonce: string;
  ipHash: string | null;
  userAgentHash: string | null;
  issuedAt: Date;
  expiresAt: Date;
}): Promise<void> => {
  const db = getDb();
  await db.query(
    `
      delete from auth_nonces
      where wallet_address = $1
        and consumed_at is null
    `,
    [params.walletAddress],
  );

  await db.query(
    `
      insert into auth_nonces (
        wallet_address,
        nonce,
        ip_hash,
        user_agent_hash,
        issued_at,
        expires_at
      )
      values ($1, $2, $3, $4, $5, $6)
    `,
    [
      params.walletAddress,
      params.nonce,
      params.ipHash,
      params.userAgentHash,
      params.issuedAt.toISOString(),
      params.expiresAt.toISOString(),
    ],
  );
};

export const findAuthNonce = async (walletAddress: string, nonce: string): Promise<AuthNonceRecord | null> => {
  const db = getDb();
  const result = await db.query<AuthNonceRecord>(
    `
      select
        id,
        wallet_address,
        nonce,
        ip_hash,
        user_agent_hash,
        issued_at,
        expires_at,
        consumed_at
      from auth_nonces
      where wallet_address = $1
        and nonce = $2
      limit 1
    `,
    [walletAddress, nonce],
  );

  return result.rows[0] ?? null;
};

export const consumeAuthNonce = async (nonceId: string): Promise<boolean> => {
  const db = getDb();
  const result = await db.query(
    `
      update auth_nonces
      set consumed_at = now()
      where id = $1
        and consumed_at is null
    `,
    [nonceId],
  );

  return result.rowCount === 1;
};

export const createSessionForWallet = async (params: {
  walletAddress: string;
  tokenHash: string;
  expiresAt: Date;
  ipHash: string | null;
  userAgentHash: string | null;
}): Promise<{ userId: string }> => {
  const db = getDb();
  const client = await db.connect();

  try {
    await client.query("begin");

    const userResult = await client.query<{ id: string }>(
      `
        insert into users (primary_wallet_address)
        values ($1)
        on conflict (primary_wallet_address)
        do update set primary_wallet_address = excluded.primary_wallet_address
        returning id
      `,
      [params.walletAddress],
    );

    const userId = userResult.rows[0]?.id;
    if (!userId) {
      throw new Error("Failed to resolve user during session creation.");
    }

    await client.query(
      `
        insert into wallets (user_id, wallet_address, is_primary)
        values ($1, $2, true)
        on conflict (wallet_address)
        do update set user_id = excluded.user_id
      `,
      [userId, params.walletAddress],
    );

    await client.query(
      `
        insert into sessions (
          user_id,
          wallet_address,
          token_hash,
          ip_hash,
          user_agent_hash,
          expires_at
        )
        values ($1, $2, $3, $4, $5, $6)
      `,
      [
        userId,
        params.walletAddress,
        params.tokenHash,
        params.ipHash,
        params.userAgentHash,
        params.expiresAt.toISOString(),
      ],
    );

    await client.query("commit");
    return { userId };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
};

export const revokeSessionByTokenHash = async (tokenHash: string): Promise<void> => {
  const db = getDb();
  await db.query(
    `
      update sessions
      set revoked_at = now()
      where token_hash = $1
        and revoked_at is null
    `,
    [tokenHash],
  );
};

export const findSessionUserByTokenHash = async (tokenHash: string): Promise<SessionUserRecord | null> => {
  const db = getDb();
  const result = await db.query<SessionUserRecord>(
    `
      select
        sessions.id as "sessionId",
        sessions.expires_at as "expiresAt",
        users.id as "userId",
        sessions.wallet_address as "walletAddress",
        users.display_name as "displayName"
      from sessions
      inner join users on users.id = sessions.user_id
      where sessions.token_hash = $1
        and sessions.revoked_at is null
        and sessions.expires_at > now()
      limit 1
    `,
    [tokenHash],
  );

  return result.rows[0] ?? null;
};

export const findUserByWalletAddress = async (walletAddress: string): Promise<{ userId: string; walletAddress: string } | null> => {
  const db = getDb();
  const result = await db.query<{ userId: string; walletAddress: string }>(
    `
      select
        users.id as "userId",
        wallets.wallet_address as "walletAddress"
      from wallets
      inner join users on users.id = wallets.user_id
      where wallets.wallet_address = $1
      limit 1
    `,
    [walletAddress],
  );

  return result.rows[0] ?? null;
};
