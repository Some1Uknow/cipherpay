#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const stateDir = path.join(os.homedir(), ".cipherpay-agent");
const statePath = path.join(stateDir, "state.enc");
const backupPath = path.join(stateDir, "recovery-bundle.enc");
const HANDLE_RE = /^[a-z][a-z0-9-]{1,30}[a-z0-9]$/;

function arg(name, fallback = "") {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

function command() {
  return process.argv[2] ?? "status";
}

function normalizeHandle(value) {
  const handle = String(value ?? "").trim().toLowerCase();
  if (!HANDLE_RE.test(handle)) {
    throw new Error("A valid agent handle is required. Use 3-32 lowercase letters, numbers, or hyphens; start with a letter and do not end with a hyphen.");
  }
  return handle;
}

function secret() {
  const value = process.env.CIPHERPAY_AGENT_SECRET;
  if (!value) throw new Error("CIPHERPAY_AGENT_SECRET is required for encrypted local state.");
  return crypto.createHash("sha256").update(value).digest();
}

function base58(bytes) {
  let value = BigInt(`0x${Buffer.from(bytes).toString("hex") || "0"}`);
  let output = "";
  while (value > 0n) {
    const mod = Number(value % 58n);
    output = BASE58[mod] + output;
    value /= 58n;
  }
  for (const byte of bytes) {
    if (byte !== 0) break;
    output = "1" + output;
  }
  return output || "1";
}

function encrypt(payload) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", secret(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString("base64url");
}

function decrypt(encoded) {
  const data = Buffer.from(encoded, "base64url");
  const iv = data.subarray(0, 12);
  const tag = data.subarray(12, 28);
  const ciphertext = data.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", secret(), iv);
  decipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8"));
}

function readState() {
  if (!fs.existsSync(statePath)) return null;
  return decrypt(fs.readFileSync(statePath, "utf8"));
}

function writeState(state) {
  fs.mkdirSync(stateDir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(statePath, encrypt(state), { mode: 0o600 });
}

function createWallet() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  const publicDer = publicKey.export({ type: "spki", format: "der" });
  const privatePem = privateKey.export({ type: "pkcs8", format: "pem" });
  const publicKeyBytes = publicDer.subarray(publicDer.length - 32);
  return {
    walletAddress: base58(publicKeyBytes),
    privateKeyPem: privatePem.toString(),
  };
}

function signMessage(privateKeyPem, message) {
  return base58(crypto.sign(null, Buffer.from(message), crypto.createPrivateKey(privateKeyPem)));
}

async function main() {
  const cmd = command();
  const existing = readState();

  if (cmd === "status") {
    console.log(JSON.stringify({ ok: true, configured: Boolean(existing), stateDir, walletAddress: existing?.walletAddress ?? null }));
    return;
  }

  if (cmd === "init") {
    const requestedHandle = arg("handle", existing?.handle ?? "");
    const wallet = existing ?? createWallet();
    const next = {
      ...wallet,
      apiBase: arg("api-base", existing?.apiBase ?? process.env.CIPHERPAY_AGENT_API_BASE ?? "https://cipherpay.fun").replace(/\/$/, ""),
      handle: normalizeHandle(requestedHandle),
      name: arg("name", existing?.name ?? requestedHandle),
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      token: existing?.token ?? null,
    };
    writeState(next);
    console.log(JSON.stringify({ ok: true, walletAddress: next.walletAddress, handle: next.handle, stateDir }));
    return;
  }

  if (!existing) throw new Error("Run init internally before this action.");

  if (cmd === "backup") {
    fs.writeFileSync(backupPath, encrypt({ ...existing, exportedAt: new Date().toISOString() }), { mode: 0o600 });
    decrypt(fs.readFileSync(backupPath, "utf8"));
    console.log(JSON.stringify({ ok: true, backupPath, verified: true }));
    return;
  }

  if (cmd === "link") {
    const code = arg("code");
    if (!code) throw new Error("--code is required.");
    const response = await fetch(`${existing.apiBase}/api/agent-pay/agent/link-requests`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        code,
        proposedHandle: existing.handle,
        proposedName: existing.name,
        agentWalletAddress: existing.walletAddress,
        agentViewingPublicKey: existing.walletAddress,
        encryptedViewingKey: "stored-locally",
        backupAttested: fs.existsSync(backupPath),
      }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "Link request failed.");
    writeState({ ...existing, token: body.personalAccessToken, linkRequestId: body.linkRequestId });
    console.log(JSON.stringify({ ok: true, status: body.status, linkRequestId: body.linkRequestId }));
    return;
  }

  if (cmd === "sign") {
    const action = arg("action");
    if (!action) throw new Error("--action is required.");
    const message = ["CipherPay Agent Pay", `Action: ${action}`, `Agent: ${existing.walletAddress}`, `Timestamp: ${new Date().toISOString()}`].join("\n");
    console.log(JSON.stringify({ ok: true, signedMessage: message, signature: signMessage(existing.privateKeyPem, message) }));
    return;
  }

  throw new Error(`Unknown command: ${cmd}`);
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : "Unknown error" }));
  process.exit(1);
});
