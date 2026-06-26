import "server-only";

import crypto from "crypto";

import { getServerConfig } from "@/lib/server-config";

function getKey() {
  return crypto.createHash("sha256").update(getServerConfig().invoiceEncryptionKey).digest();
}

export function hashSecret(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function createOpaqueToken(prefix: string) {
  return `${prefix}_${crypto.randomBytes(30).toString("base64url")}`;
}

export function createLinkCode() {
  const raw = crypto.randomBytes(5).toString("base64url").toUpperCase().replace(/[^A-Z0-9]/g, "X").slice(0, 8);
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
}

export function encryptNullable(value: string | null | undefined) {
  if (!value) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString("base64url");
}

export function decryptNullable(value: string | null | undefined) {
  if (!value) return null;
  const data = Buffer.from(value, "base64url");
  const iv = data.subarray(0, 12);
  const tag = data.subarray(12, 28);
  const ciphertext = data.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
