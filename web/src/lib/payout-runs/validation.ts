import { PublicKey } from "@solana/web3.js";

import type { PayoutRowDraft, PayoutRowIssue } from "@/lib/payout-runs/types";

export const CSV_SAMPLE = `recipient_name,wallet_address,amount
Ava Patel,9B3Y2dXhN6LQW8dyL5o6z8UZqv2q1X3dQ5bTA2sQkz4J,1850
Northline Studio,GW91mC6M7xTnN4aMvQq5jQ9nG2L3w4LfA1uQw8fLm9rA,3200`;

export function createEmptyPayoutRow(): PayoutRowDraft {
  return {
    id: crypto.randomUUID(),
    recipientName: "",
    walletAddress: "",
    amount: "",
  };
}

export function ensureMinimumRows(rows: PayoutRowDraft[], minimum = 3): PayoutRowDraft[] {
  const nextRows = [...rows];
  while (nextRows.length < minimum) {
    nextRows.push(createEmptyPayoutRow());
  }
  return nextRows;
}

export function isRowFilled(row: PayoutRowDraft): boolean {
  return Boolean(row.recipientName.trim() || row.walletAddress.trim() || row.amount.trim());
}

export function serializeDraft(mode: string, rows: PayoutRowDraft[]): string {
  return JSON.stringify({
    mode,
    rows: rows.map((row) => ({
      recipientName: row.recipientName,
      walletAddress: row.walletAddress,
      amount: row.amount,
    })),
  });
}

export function validateRows(rows: PayoutRowDraft[]): PayoutRowIssue[] {
  const duplicates = new Set<string>();
  const seen = new Set<string>();

  for (const row of rows) {
    const key = `${row.walletAddress.trim().toLowerCase()}::${row.amount.trim()}`;
    if (!row.walletAddress.trim() || !row.amount.trim()) continue;
    if (seen.has(key)) duplicates.add(key);
    seen.add(key);
  }

  return rows.map((row) => {
    const issues: PayoutRowIssue = {};

    if (!row.recipientName.trim()) {
      issues.recipientName = "Add a recipient name.";
    }

    if (!row.walletAddress.trim()) {
      issues.walletAddress = "Add a Solana wallet address.";
    } else {
      try {
        new PublicKey(row.walletAddress.trim());
      } catch {
        issues.walletAddress = "Use a valid Solana wallet address.";
      }
    }

    if (!row.amount.trim()) {
      issues.amount = "Add an amount.";
    } else {
      const normalized = Number(row.amount);
      if (!Number.isFinite(normalized)) {
        issues.amount = "Use a number like 1250 or 1250.50.";
      } else if (normalized <= 0) {
        issues.amount = "Amount must be greater than zero.";
      } else if (!/^\d+(\.\d{1,2})?$/.test(row.amount.trim())) {
        issues.amount = "Use up to 2 decimal places for USDC.";
      }
    }

    const duplicateKey = `${row.walletAddress.trim().toLowerCase()}::${row.amount.trim()}`;
    if (!issues.walletAddress && !issues.amount && duplicates.has(duplicateKey)) {
      issues.row = "Duplicate wallet and amount detected.";
    }

    return issues;
  });
}

export function parseCsvRows(csvText: string): PayoutRowDraft[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  const [header, ...dataLines] = lines;
  const headerParts = header.split(",").map((part) => part.trim().toLowerCase());
  const expected = ["recipient_name", "wallet_address", "amount"];

  if (expected.some((field, index) => headerParts[index] !== field)) {
    throw new Error("Use the CSV columns recipient_name,wallet_address,amount in that order.");
  }

  return dataLines.map((line) => {
    const [recipientName = "", walletAddress = "", amount = ""] = line.split(",").map((part) => part.trim());
    return {
      id: crypto.randomUUID(),
      recipientName,
      walletAddress,
      amount,
    };
  });
}
