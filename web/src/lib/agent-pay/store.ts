import "server-only";

import { getDb } from "@/lib/db";
import { solInputToBaseUnits } from "@/lib/agent-pay/amounts";
import { createLinkCode, createOpaqueToken, decryptNullable, encryptNullable, hashSecret } from "@/lib/agent-pay/crypto";
import type {
  AgentActivity,
  AgentApprovalRequest,
  AgentFundingRequest,
  AgentInvoice,
  AgentLinkRequest,
  AgentPayOverview,
  LinkedAgent,
} from "@/lib/agent-pay/types";

const HANDLE_RE = /^[a-z][a-z0-9-]{1,30}[a-z0-9]$/;
const AGENT_PAY_MISSING_RELATIONS = new Set([
  "agents",
  "agent_link_codes",
  "agent_link_requests",
  "agent_credentials",
  "agent_funding_requests",
  "agent_approval_requests",
  "agent_invoices",
  "agent_blocks",
  "agent_activity",
  "agent_private_utxos",
]);

export class AgentPaySchemaMissingError extends Error {
  constructor() {
    super("Agent Pay database tables are missing. Run pnpm db:migrate:agent-pay-overhaul.");
    this.name = "AgentPaySchemaMissingError";
  }
}

export function isAgentPaySchemaMissingError(error: unknown): error is AgentPaySchemaMissingError {
  return error instanceof AgentPaySchemaMissingError;
}

function isPgMissingRelation(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: string; table?: string; message?: string };
  if (candidate.code !== "42P01") return false;
  if (candidate.table && AGENT_PAY_MISSING_RELATIONS.has(candidate.table)) return true;
  return Boolean(candidate.message && [...AGENT_PAY_MISSING_RELATIONS].some((relation) => candidate.message!.includes(relation)));
}

type AgentRow = {
  id: string;
  owner_wallet_address: string;
  handle: string;
  display_name: string;
  agent_wallet_address: string;
  shielded_balance_base_units: string;
  asset_symbol: string;
  asset_decimals: number;
  policy_mode: "approval_required" | "autonomous";
  per_tx_limit_base_units: string | null;
  rolling_24h_limit_base_units: string | null;
  public_withdrawals_enabled: boolean;
  status: "active" | "revoked" | "archived";
  linked_at: Date;
  updated_at: Date;
};

function assertHandle(handle: string) {
  if (!HANDLE_RE.test(handle)) {
    throw new Error("Handle must be 3-32 lowercase letters, numbers, or hyphens. Start with a letter and do not end with a hyphen.");
  }
}

function mapAgent(row: AgentRow): LinkedAgent {
  return {
    id: row.id,
    handle: row.handle,
    displayName: row.display_name,
    ownerWalletAddress: row.owner_wallet_address,
    agentWalletAddress: row.agent_wallet_address,
    shieldedBalanceBaseUnits: row.shielded_balance_base_units,
    assetSymbol: row.asset_symbol,
    assetDecimals: row.asset_decimals,
    policyMode: row.policy_mode,
    perTxLimitBaseUnits: row.per_tx_limit_base_units,
    rolling24hLimitBaseUnits: row.rolling_24h_limit_base_units,
    publicWithdrawalsEnabled: row.public_withdrawals_enabled,
    status: row.status,
    linkedAt: row.linked_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function createOwnerLinkCode(userId: string, ownerWalletAddress: string) {
  const code = createLinkCode();
  const db = getDb();
  await db.query(
    `
      insert into agent_link_codes (user_id, owner_wallet_address, code_hash, expires_at)
      values ($1, $2, $3, now() + interval '10 minutes')
    `,
    [userId, ownerWalletAddress, hashSecret(code)],
  );
  return { code, expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString() };
}

export async function createAgentLinkRequest(params: {
  code: string;
  proposedHandle: string;
  proposedName: string;
  agentWalletAddress: string;
  agentViewingPublicKey?: string | null;
  encryptedViewingKey?: string | null;
  backupAttested: boolean;
}) {
  const proposedHandle = params.proposedHandle.trim().toLowerCase();
  assertHandle(proposedHandle);
  const proposedName = params.proposedName.trim() || proposedHandle;
  const personalAccessToken = createOpaqueToken("cpa");
  const db = getDb();
  const client = await db.connect();

  try {
    await client.query("begin");
    const codeResult = await client.query<{ id: string; user_id: string }>(
      `
        update agent_link_codes
        set consumed_at = now()
        where code_hash = $1
          and consumed_at is null
          and expires_at > now()
        returning id, user_id
      `,
      [hashSecret(params.code.trim().toUpperCase())],
    );
    const linkCode = codeResult.rows[0];
    if (!linkCode) throw new Error("Link code is invalid or expired.");

    const requestResult = await client.query<{ id: string }>(
      `
        insert into agent_link_requests (
          user_id, link_code_id, proposed_handle, proposed_name, agent_wallet_address,
          agent_viewing_public_key, encrypted_viewing_key, backup_attested_at, pending_pat_hash
        )
        values ($1, $2, $3, $4, $5, $6, $7, case when $8 then now() else null end, $9)
        returning id
      `,
      [
        linkCode.user_id,
        linkCode.id,
        proposedHandle,
        proposedName,
        params.agentWalletAddress.trim(),
        params.agentViewingPublicKey?.trim() || null,
        params.encryptedViewingKey?.trim() || null,
        params.backupAttested,
        hashSecret(personalAccessToken),
      ],
    );

    await client.query("commit");
    return { linkRequestId: requestResult.rows[0].id, personalAccessToken, status: "pending" as const };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function approveLinkRequest(params: {
  userId: string;
  linkRequestId: string;
  handle: string;
  displayName: string;
}) {
  const handle = params.handle.trim().toLowerCase();
  assertHandle(handle);
  const displayName = params.displayName.trim() || handle;
  const db = getDb();
  const client = await db.connect();

  try {
    await client.query("begin");
    const requestResult = await client.query<{
      id: string;
      user_id: string;
      agent_wallet_address: string;
      agent_viewing_public_key: string | null;
      encrypted_viewing_key: string | null;
      pending_pat_hash: string;
      owner_wallet_address: string;
    }>(
      `
        select r.*, c.owner_wallet_address
        from agent_link_requests r
        join agent_link_codes c on c.id = r.link_code_id
        where r.id = $1
          and r.user_id = $2
          and r.status = 'pending'
        for update
      `,
      [params.linkRequestId, params.userId],
    );
    const request = requestResult.rows[0];
    if (!request) throw new Error("Pending link request not found.");

    const agentResult = await client.query<{ id: string }>(
      `
        insert into agents (
          user_id, owner_wallet_address, handle, display_name, agent_wallet_address,
          agent_viewing_public_key, encrypted_viewing_key
        )
        values ($1, $2, $3, $4, $5, $6, $7)
        returning id
      `,
      [
        params.userId,
        request.owner_wallet_address,
        handle,
        displayName,
        request.agent_wallet_address,
        request.agent_viewing_public_key,
        request.encrypted_viewing_key,
      ],
    );
    const agentId = agentResult.rows[0].id;

    await client.query(
      `insert into agent_credentials (agent_id, token_hash) values ($1, $2)`,
      [agentId, request.pending_pat_hash],
    );
    await client.query(
      `update agent_link_requests set status = 'approved', reviewed_at = now(), updated_at = now() where id = $1`,
      [params.linkRequestId],
    );
    await insertActivity(client, {
      userId: params.userId,
      agentId,
      eventType: "agent_linked",
      counterparty: handle,
      summary: `Agent ${handle} linked.`,
    });

    await client.query("commit");
    return agentId;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function rejectLinkRequest(userId: string, linkRequestId: string) {
  const db = getDb();
  await db.query(
    `
      update agent_link_requests
      set status = 'rejected', reviewed_at = now(), updated_at = now()
      where id = $1 and user_id = $2 and status = 'pending'
    `,
    [linkRequestId, userId],
  );
}

export async function resolveAgentByToken(token: string) {
  const db = getDb();
  const result = await db.query<{
    agent_id: string;
    user_id: string;
    owner_wallet_address: string;
    handle: string;
    agent_wallet_address: string;
    shielded_balance_base_units: string;
    asset_symbol: string;
    asset_decimals: number;
    policy_mode: "approval_required" | "autonomous";
    per_tx_limit_base_units: string | null;
    rolling_24h_limit_base_units: string | null;
    public_withdrawals_enabled: boolean;
    status: string;
  }>(
    `
      update agent_credentials c
      set last_used_at = now()
      from agents a
      where c.agent_id = a.id
        and c.token_hash = $1
        and c.revoked_at is null
        and a.status = 'active'
      returning
        a.id as agent_id,
        a.user_id,
        a.owner_wallet_address,
        a.handle,
        a.agent_wallet_address,
        a.shielded_balance_base_units,
        a.asset_symbol,
        a.asset_decimals,
        a.policy_mode,
        a.per_tx_limit_base_units,
        a.rolling_24h_limit_base_units,
        a.public_withdrawals_enabled,
        a.status
    `,
    [hashSecret(token)],
  );
  return result.rows[0] ?? null;
}

export async function listOverview(userId: string): Promise<AgentPayOverview> {
  const db = getDb();
  const getOverviewRows = async () =>
    Promise.all([
      db.query<AgentRow>(`select * from agents where user_id = $1 order by linked_at desc`, [userId]),
      db.query<{
        id: string;
        proposed_handle: string;
        proposed_name: string;
        agent_wallet_address: string;
        agent_viewing_public_key: string | null;
        backup_attested_at: Date | null;
        status: "pending" | "approved" | "rejected" | "expired";
        created_at: Date;
      }>(
        `
          select id, proposed_handle, proposed_name, agent_wallet_address, agent_viewing_public_key, backup_attested_at, status, created_at
          from agent_link_requests
          where user_id = $1 and status = 'pending'
          order by created_at desc
        `,
        [userId],
      ),
      db.query<{
        id: string;
        agent_id: string;
        handle: string;
        requested_amount_input: string | null;
        requested_amount_base_units: string | null;
        note_ciphertext: string | null;
        status: "pending" | "approved" | "dismissed" | "funded" | "cancelled";
        created_at: Date;
      }>(
        `
          select f.id, f.agent_id, a.handle, f.requested_amount_input, f.requested_amount_base_units, f.note_ciphertext, f.status, f.created_at
          from agent_funding_requests f
          join agents a on a.id = f.agent_id
          where f.user_id = $1 and f.status = 'pending'
          order by f.created_at desc
        `,
        [userId],
      ),
      db.query<{
        id: string;
        agent_id: string;
        handle: string;
        kind: AgentApprovalRequest["kind"];
        amount_base_units: string | null;
        fee_base_units: string | null;
        target: string | null;
        metadata_ciphertext: string | null;
        status: AgentApprovalRequest["status"];
        expires_at: Date;
        created_at: Date;
      }>(
        `
          select r.id, r.agent_id, a.handle, r.kind, r.amount_base_units, r.fee_base_units, r.target, r.metadata_ciphertext, r.status, r.expires_at, r.created_at
          from agent_approval_requests r
          join agents a on a.id = r.agent_id
          where r.user_id = $1 and r.status = 'pending'
          order by r.created_at desc
        `,
        [userId],
      ),
      db.query<{
        id: string;
        invoice_number: string;
        issuer_agent_id: string;
        issuer_handle: string;
        recipient_agent_id: string | null;
        recipient_handle: string | null;
        human_payment_slug: string | null;
        payer_wallet_address: string | null;
        amount_input: string;
        amount_base_units: string;
        asset_symbol: string;
        encrypted_title: string;
        encrypted_description: string | null;
        encrypted_external_ref: string | null;
        status: AgentInvoice["status"];
        due_at: Date | null;
        paid_at: Date | null;
        created_at: Date;
      }>(
        `
          select i.*, issuer.handle as issuer_handle
          from agent_invoices i
          join agents issuer on issuer.id = i.issuer_agent_id
          where i.issuer_user_id = $1
             or i.recipient_agent_id in (select id from agents where user_id = $1)
          order by i.created_at desc
          limit 20
        `,
        [userId],
      ),
      db.query<{
        id: string;
        agent_id: string | null;
        handle: string | null;
        event_type: string;
        amount_base_units: string | null;
        asset_symbol: string;
        counterparty: string | null;
        status: string;
        metadata_ciphertext: string | null;
        created_at: Date;
      }>(
        `
          select act.id, act.agent_id, a.handle, act.event_type, act.amount_base_units, act.asset_symbol, act.counterparty, act.status, act.metadata_ciphertext, act.created_at
          from agent_activity act
          left join agents a on a.id = act.agent_id
          where act.user_id = $1
          order by act.created_at desc
          limit 30
        `,
        [userId],
      ),
    ]);

  const [agents, links, funding, approvals, invoices, activity] = await getOverviewRows().catch((error) => {
    if (isPgMissingRelation(error)) throw new AgentPaySchemaMissingError();
    throw error;
  });

  return {
    agents: agents.rows.map(mapAgent),
    pendingLinks: links.rows.map((row): AgentLinkRequest => ({
      id: row.id,
      proposedHandle: row.proposed_handle,
      proposedName: row.proposed_name,
      agentWalletAddress: row.agent_wallet_address,
      agentViewingPublicKey: row.agent_viewing_public_key,
      backupAttestedAt: row.backup_attested_at?.toISOString() ?? null,
      status: row.status,
      createdAt: row.created_at.toISOString(),
    })),
    fundingRequests: funding.rows.map((row): AgentFundingRequest => ({
      id: row.id,
      agentId: row.agent_id,
      agentHandle: row.handle,
      requestedAmountInput: row.requested_amount_input,
      requestedAmountBaseUnits: row.requested_amount_base_units,
      note: decryptNullable(row.note_ciphertext),
      status: row.status,
      createdAt: row.created_at.toISOString(),
    })),
    approvals: approvals.rows.map((row): AgentApprovalRequest => ({
      id: row.id,
      agentId: row.agent_id,
      agentHandle: row.handle,
      kind: row.kind,
      amountBaseUnits: row.amount_base_units,
      feeBaseUnits: row.fee_base_units,
      target: row.target,
      summary: decryptNullable(row.metadata_ciphertext),
      status: row.status,
      expiresAt: row.expires_at.toISOString(),
      createdAt: row.created_at.toISOString(),
    })),
    invoices: invoices.rows.map((row): AgentInvoice => ({
      id: row.id,
      invoiceNumber: row.invoice_number,
      issuerAgentId: row.issuer_agent_id,
      issuerHandle: row.issuer_handle,
      recipientAgentId: row.recipient_agent_id,
      recipientHandle: row.recipient_handle,
      humanPaymentSlug: row.human_payment_slug,
      payerWalletAddress: row.payer_wallet_address,
      amountInput: row.amount_input,
      amountBaseUnits: row.amount_base_units,
      assetSymbol: row.asset_symbol,
      title: decryptNullable(row.encrypted_title) ?? "Untitled invoice",
      description: decryptNullable(row.encrypted_description),
      externalRef: decryptNullable(row.encrypted_external_ref),
      status: row.status,
      dueAt: row.due_at?.toISOString() ?? null,
      paidAt: row.paid_at?.toISOString() ?? null,
      createdAt: row.created_at.toISOString(),
    })),
    activity: activity.rows.map((row): AgentActivity => ({
      id: row.id,
      agentId: row.agent_id,
      agentHandle: row.handle,
      eventType: row.event_type,
      amountBaseUnits: row.amount_base_units,
      assetSymbol: row.asset_symbol,
      counterparty: row.counterparty,
      status: row.status,
      summary: decryptNullable(row.metadata_ciphertext),
      createdAt: row.created_at.toISOString(),
    })),
  };
}

export async function updateAgentPolicy(params: {
  userId: string;
  agentId: string;
  policyMode: "approval_required" | "autonomous";
  perTxLimitBaseUnits?: string | null;
  rolling24hLimitBaseUnits?: string | null;
  publicWithdrawalsEnabled?: boolean;
}) {
  const db = getDb();
  const client = await db.connect();

  try {
    await client.query("begin");
    const result = await client.query<{ handle: string }>(
      `
        update agents
        set policy_mode = $3,
            per_tx_limit_base_units = $4,
            rolling_24h_limit_base_units = $5,
            public_withdrawals_enabled = $6,
            updated_at = now()
        where id = $1
          and user_id = $2
          and status = 'active'
        returning handle
      `,
      [
        params.agentId,
        params.userId,
        params.policyMode,
        params.perTxLimitBaseUnits ?? null,
        params.rolling24hLimitBaseUnits ?? null,
        params.publicWithdrawalsEnabled ?? false,
      ],
    );

    const updated = result.rows[0];
    if (!updated) throw new Error("Active agent not found.");

    await insertActivity(client, {
      userId: params.userId,
      agentId: params.agentId,
      eventType: "agent_policy_updated",
      counterparty: updated.handle,
      status: "saved",
      summary: `Policy saved: ${params.policyMode === "autonomous" ? "autonomous with limits" : "approval required"}.`,
    });

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function recordOwnerFundingIntent(params: { userId: string; agentId: string; amountInput: string }) {
  const amountBaseUnits = solInputToBaseUnits(params.amountInput);
  const db = getDb();
  await db.query(
    `
      insert into agent_activity (user_id, agent_id, event_type, amount_base_units, counterparty, status, metadata_ciphertext)
      select $1, id, 'agent_funded', $3, handle, 'pending_wallet_signature', $4
      from agents
      where id = $2 and user_id = $1
    `,
    [params.userId, params.agentId, amountBaseUnits, encryptNullable(`Owner started funding for ${params.amountInput} SOL.`)],
  );
}

export async function recordConfirmedAgentFunding(params: {
  userId: string;
  agentId: string;
  amountInput: string;
  depositSignature: string;
  depositCommitment?: string | null;
  serializedUtxo: string;
}) {
  const amountBaseUnits = solInputToBaseUnits(params.amountInput);
  const db = getDb();
  const client = await db.connect();

  try {
    await client.query("begin");
    const insertResult = await client.query<{ id: string; handle: string }>(
      `
        insert into agent_private_utxos (
          agent_id, user_id, amount_base_units, deposit_signature, deposit_commitment, serialized_utxo_ciphertext
        )
        select id, user_id, $3, $4, $5, $6
        from agents
        where id = $1
          and user_id = $2
          and status = 'active'
        on conflict (deposit_signature) do nothing
        returning id, (select handle from agents where id = $1) as handle
      `,
      [
        params.agentId,
        params.userId,
        amountBaseUnits,
        params.depositSignature.trim(),
        params.depositCommitment?.trim() || null,
        encryptNullable(params.serializedUtxo),
      ],
    );

    const inserted = insertResult.rows[0];
    if (!inserted) {
      throw new Error("Funding deposit was already recorded or the agent is not active.");
    }

    await client.query(
      `
        update agents
        set shielded_balance_base_units = shielded_balance_base_units + $3::numeric,
            updated_at = now()
        where id = $1 and user_id = $2
      `,
      [params.agentId, params.userId, amountBaseUnits],
    );

    await insertActivity(client, {
      userId: params.userId,
      agentId: params.agentId,
      eventType: "agent_funded",
      amountBaseUnits,
      counterparty: inserted.handle,
      status: "confirmed",
      summary: `Cloak funding confirmed. Deposit ${params.depositSignature.trim()}.`,
    });

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function createFundingRequest(params: { agentId: string; userId: string; amountInput?: string; note?: string }) {
  const amountBaseUnits = params.amountInput ? solInputToBaseUnits(params.amountInput) : null;
  const db = getDb();
  await db.query(
    `
      insert into agent_funding_requests (agent_id, user_id, requested_amount_base_units, requested_amount_input, note_ciphertext)
      values ($1, $2, $3, $4, $5)
    `,
    [params.agentId, params.userId, amountBaseUnits, params.amountInput ?? null, encryptNullable(params.note)],
  );
  await db.query(
    `
      insert into agent_activity (user_id, agent_id, event_type, amount_base_units, status, metadata_ciphertext)
      values ($1, $2, 'agent_funding_requested', $3, 'pending', $4)
    `,
    [params.userId, params.agentId, amountBaseUnits, encryptNullable(params.note ?? "Agent requested funding.")],
  );
}

export async function createInvoice(params: {
  issuerAgentId: string;
  issuerUserId: string;
  recipientHandle?: string | null;
  amountInput: string;
  title: string;
  description?: string | null;
  dueAt?: string | null;
  externalRef?: string | null;
  humanContact?: string | null;
}) {
  const amountBaseUnits = solInputToBaseUnits(params.amountInput);
  const db = getDb();
  const recipient = params.recipientHandle
    ? await db.query<{ id: string; handle: string }>(`select id, handle from agents where handle = $1 and status = 'active'`, [
        params.recipientHandle.trim().toLowerCase(),
      ])
    : null;
  const recipientAgent = recipient?.rows[0] ?? null;
  const slug = recipientAgent ? null : createOpaqueToken("inv").replace("inv_", "");
  const invoiceNumber = `AG-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

  const result = await db.query<{ id: string }>(
    `
      insert into agent_invoices (
        invoice_number, issuer_agent_id, issuer_user_id, recipient_agent_id, recipient_handle, human_payment_slug,
        amount_base_units, amount_input, encrypted_title, encrypted_description, encrypted_external_ref, encrypted_human_contact, due_at
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      returning id
    `,
    [
      invoiceNumber,
      params.issuerAgentId,
      params.issuerUserId,
      recipientAgent?.id ?? null,
      recipientAgent?.handle ?? params.recipientHandle?.trim().toLowerCase() ?? null,
      slug,
      amountBaseUnits,
      params.amountInput,
      encryptNullable(params.title.trim() || "Invoice"),
      encryptNullable(params.description),
      encryptNullable(params.externalRef),
      encryptNullable(params.humanContact),
      params.dueAt ? new Date(params.dueAt).toISOString() : null,
    ],
  );

  await db.query(
    `
      insert into agent_activity (user_id, agent_id, event_type, amount_base_units, counterparty, status, metadata_ciphertext)
      values ($1, $2, 'agent_invoice_issued', $3, $4, 'open', $5)
    `,
    [
      params.issuerUserId,
      params.issuerAgentId,
      amountBaseUnits,
      recipientAgent?.handle ?? "human_link",
      encryptNullable(params.title),
    ],
  );

  return { id: result.rows[0].id, invoiceNumber, humanPaymentSlug: slug };
}

async function insertActivity(
  client: { query: (query: string, values: unknown[]) => Promise<unknown> },
  params: {
    userId: string;
    agentId: string;
    eventType: string;
    amountBaseUnits?: string | null;
    counterparty?: string | null;
    status?: string;
    summary?: string | null;
  },
) {
  await client.query(
    `
      insert into agent_activity (user_id, agent_id, event_type, amount_base_units, counterparty, status, metadata_ciphertext)
      values ($1, $2, $3, $4, $5, $6, $7)
    `,
    [
      params.userId,
      params.agentId,
      params.eventType,
      params.amountBaseUnits ?? null,
      params.counterparty ?? null,
      params.status ?? "recorded",
      encryptNullable(params.summary),
    ],
  );
}
