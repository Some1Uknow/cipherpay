import "server-only";

import { publicConfig } from "@/lib/public-config";

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const parseIntEnv = (name: string, fallback: number): number => {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  if (Number.isNaN(value)) {
    throw new Error(`Invalid integer environment variable: ${name}`);
  }
  return value;
};

type ServerConfig = {
  appUrl: string;
  solanaCluster: string;
  solanaRpcUrl: string;
  phase1TokenMint: string;
  phase1TokenSymbol: string;
  phase1TokenDecimals: number;
  supportedWallets: string[];
  databaseUrl: string;
  sessionCookieName: string;
  sessionTtlHours: number;
  sessionSigningSecret: string;
  siwsDomain: string;
  siwsStatement: string;
  siwsNonceTtlMinutes: number;
  invoiceEncryptionKey: string;
  maxCsvUploadBytes: number;
  maxCsvImportRows: number;
};

let cachedServerConfig: ServerConfig | null = null;

export const getServerConfig = (): ServerConfig => {
  if (cachedServerConfig) {
    return cachedServerConfig;
  }

  cachedServerConfig = {
    ...publicConfig,
    databaseUrl: required("DATABASE_URL"),
    sessionCookieName: process.env.SESSION_COOKIE_NAME ?? "cipherpay_session",
    sessionTtlHours: parseIntEnv("SESSION_TTL_HOURS", 24),
    sessionSigningSecret: required("SESSION_SIGNING_SECRET"),
    siwsDomain: process.env.SIWS_DOMAIN ?? "localhost:3000",
    siwsStatement:
      process.env.SIWS_STATEMENT ??
      "Sign this message to access CipherPay. This does not send a transaction or spend funds.",
    siwsNonceTtlMinutes: parseIntEnv("SIWS_NONCE_TTL_MINUTES", 10),
    invoiceEncryptionKey: required("INVOICE_ENCRYPTION_KEY"),
    maxCsvUploadBytes: parseIntEnv("MAX_CSV_UPLOAD_BYTES", 2_097_152),
    maxCsvImportRows: parseIntEnv("MAX_CSV_IMPORT_ROWS", 1000),
  };

  return cachedServerConfig;
};

export type { ServerConfig };
