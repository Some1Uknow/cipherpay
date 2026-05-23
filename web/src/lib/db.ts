import "server-only";

import { Pool } from "pg";

import { getServerConfig } from "@/lib/server-config";

declare global {
  // eslint-disable-next-line no-var
  var __cipherpayPool: Pool | undefined;
}

export const getDb = (): Pool => {
  if (global.__cipherpayPool) {
    return global.__cipherpayPool;
  }

  const pool = new Pool({
    connectionString: getServerConfig().databaseUrl,
    max: 10,
  });

  if (process.env.NODE_ENV !== "production") {
    global.__cipherpayPool = pool;
  }

  return pool;
};
