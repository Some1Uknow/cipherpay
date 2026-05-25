export type PayoutRunEntryMode = "manual" | "csv";

export type PayoutRunStatus =
  | "draft"
  | "ready"
  | "deposit_required"
  | "depositing"
  | "deposit_confirmed"
  | "transferring"
  | "partially_paid"
  | "submitting"
  | "submitted"
  | "failed"
  | "completed";

export type PayoutRowStatus = "draft" | "ready" | "queued" | "paid_private" | "submitted" | "confirmed" | "failed";

export type PrivatePayoutAsset = {
  symbol: "SOL" | "USDC";
  mint: string;
  decimals: number;
  displayName: string;
  fundingBehavior: "wrap_native_sol" | "spl_token";
};

export type PayoutRowDraft = {
  id: string;
  recipientName: string;
  walletAddress: string;
  amount: string;
  amountBaseUnits?: string | null;
  rowStatus?: PayoutRowStatus;
  txSignature?: string | null;
  clientRefId?: string | null;
  magicblockTransferSignature?: string | null;
  magicblockTransferSendTo?: "base" | "ephemeral" | null;
  privateTransferSplit?: number;
  privateTransferMinDelayMs?: number;
  privateTransferMaxDelayMs?: number;
  privateStatus?: string | null;
  errorMessage?: string | null;
};

export type PayoutRowIssue = {
  recipientName?: string;
  walletAddress?: string;
  amount?: string;
  row?: string;
};

export type PersistedPayoutRun = {
  id: string;
  userId: string;
  walletAddress: string;
  entryMode: PayoutRunEntryMode;
  status: PayoutRunStatus;
  totalAmount: string;
  payoutRail: string;
  assetMint: string | null;
  assetSymbol: string;
  assetDecimals: number;
  totalBaseUnits: string | null;
  magicblockValidator: string | null;
  magicblockDepositSignature: string | null;
  magicblockDepositSendTo: "base" | "ephemeral" | null;
  magicblockPrivateStatus: string | null;
  privateBalanceBefore: string | null;
  privateBalanceAfter: string | null;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
  lastInteractedAt: string;
  submittedAt: string | null;
  rows: PayoutRowDraft[];
};
