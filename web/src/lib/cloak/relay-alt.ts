"use client";

import { AddressLookupTableAccount, PublicKey, type Connection } from "@solana/web3.js";

import { cloakConfig } from "@/lib/cloak/config";

type RelayHealthResponse = {
  tx_alt_addresses?: string[];
  altAddresses?: string[];
  addressLookupTables?: string[];
};

const cache = new Map<string, AddressLookupTableAccount[]>();
const inflight = new Map<string, Promise<AddressLookupTableAccount[]>>();

export async function loadCloakRelayAlt(connection: Connection, relayUrl = cloakConfig.relayUrl): Promise<AddressLookupTableAccount[]> {
  if (cloakConfig.cluster !== "devnet") return [];

  const cached = cache.get(relayUrl);
  if (cached) return cached;

  const existing = inflight.get(relayUrl);
  if (existing) return existing;

  const promise = resolveRelayAlts(connection, relayUrl);
  inflight.set(relayUrl, promise);

  try {
    const resolved = await promise;
    cache.set(relayUrl, resolved);
    return resolved;
  } finally {
    inflight.delete(relayUrl);
  }
}

export function clearCloakRelayAltCache() {
  cache.clear();
  inflight.clear();
}

async function resolveRelayAlts(connection: Connection, relayUrl: string) {
  const addresses = await fetchRelayAltAddresses(relayUrl);
  const accounts: AddressLookupTableAccount[] = [];

  for (const address of addresses) {
    try {
      const response = await connection.getAddressLookupTable(new PublicKey(address));
      if (response.value) accounts.push(response.value);
    } catch {
      // ALT resolution is an optimization. Let the SDK fall back if this fails.
    }
  }

  return accounts;
}

async function fetchRelayAltAddresses(relayUrl: string): Promise<string[]> {
  try {
    const response = await fetch(`${relayUrl.replace(/\/$/, "")}/health`, { cache: "no-store" });
    if (!response.ok) return [];

    const body = (await response.json()) as RelayHealthResponse;
    return body.tx_alt_addresses ?? body.altAddresses ?? body.addressLookupTables ?? [];
  } catch {
    return [];
  }
}

