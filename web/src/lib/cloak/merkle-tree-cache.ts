"use client";

import { MERKLE_TREE_HEIGHT, buildMerkleTree, type MerkleTree } from "@cloak.dev/sdk";
import type { PublicKey } from "@solana/web3.js";

import type { CloakCluster } from "@/lib/cloak/config";

const STORAGE_PREFIX = "cipherpay:cloak:merkle-tree:v1";
const MAX_AGE_MS = 30 * 60_000;

type SerializedMerkleTree = {
  height: number;
  leaves: string[];
  root: string;
  length: number;
  savedAt: number;
};

function isBrowser() {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

function key(cluster: CloakCluster, programId: PublicKey | string) {
  const programIdString = typeof programId === "string" ? programId : programId.toBase58();
  return `${STORAGE_PREFIX}:${cluster}:${programIdString}`;
}

function bigintToHex(value: bigint) {
  return value.toString(16);
}

function hexToBigint(value: string) {
  return BigInt(value.startsWith("0x") ? value : `0x${value}`);
}

function isSerializedMerkleTree(value: unknown): value is SerializedMerkleTree {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.height === "number" &&
    Array.isArray(record.leaves) &&
    record.leaves.every((leaf) => typeof leaf === "string") &&
    typeof record.root === "string" &&
    typeof record.length === "number" &&
    typeof record.savedAt === "number"
  );
}

export function saveMerkleTreeCache(cluster: CloakCluster, programId: PublicKey | string, tree: MerkleTree | undefined): void {
  if (!isBrowser() || !tree) return;

  try {
    const serialized: SerializedMerkleTree = {
      height: MERKLE_TREE_HEIGHT,
      leaves: tree.leaves().map(bigintToHex),
      root: bigintToHex(tree.root()),
      length: tree.length,
      savedAt: Date.now(),
    };
    window.sessionStorage.setItem(key(cluster, programId), JSON.stringify(serialized));
  } catch {
    // Best-effort cache only.
  }
}

export async function loadMerkleTreeCache(cluster: CloakCluster, programId: PublicKey | string): Promise<MerkleTree | undefined> {
  if (!isBrowser()) return undefined;

  const storageKey = key(cluster, programId);
  try {
    const raw = window.sessionStorage.getItem(storageKey);
    if (!raw) return undefined;

    const parsed: unknown = JSON.parse(raw);
    if (!isSerializedMerkleTree(parsed) || Date.now() - parsed.savedAt > MAX_AGE_MS) {
      window.sessionStorage.removeItem(storageKey);
      return undefined;
    }

    return await buildMerkleTree(parsed.leaves.map(hexToBigint), parsed.height);
  } catch {
    try {
      window.sessionStorage.removeItem(storageKey);
    } catch {
      // Ignore cleanup failures.
    }
    return undefined;
  }
}

export function clearMerkleTreeCache(cluster: CloakCluster, programId: PublicKey | string): void {
  if (!isBrowser()) return;
  try {
    window.sessionStorage.removeItem(key(cluster, programId));
  } catch {
    // Ignore cleanup failures.
  }
}

