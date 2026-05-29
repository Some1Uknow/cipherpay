export type PayoutRunEntryMode = "manual" | "csv";
export type PayoutRail = "cloak";

export type PayoutRunStatus =
  | "draft"
  | "ready"
  | "depositing"
  | "deposit_confirmed"
  | "paying"
  | "partially_paid"
  | "failed"
  | "completed"
  | "recoverable";

export type PayoutRowStatus = "draft" | "ready" | "queued" | "paying" | "paid_private" | "failed";

export type PrivatePayoutAsset = {
  symbol: "SOL" | "USDC";
  mint: string;
  decimals: number;
  displayName: string;
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
  privateWithdrawSignature?: string | null;
  grossBaseUnits?: string | null;
  feeBaseUnits?: string | null;
  netBaseUnits?: string | null;
  attemptCount?: number;
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
  payoutRail: PayoutRail;
  assetMint: string | null;
  assetSymbol: string;
  assetDecimals: number;
  totalBaseUnits: string | null;
  privacyCluster: string | null;
  cloakProgramId: string | null;
  cloakRelayUrl: string | null;
  privateDepositSignature: string | null;
  privateStatus: string | null;
  totalFeeBaseUnits: string | null;
  totalNetBaseUnits: string | null;
  currentChangeUtxoCommitment: string | null;
  recoveryState: string | null;
  privateBalanceBefore: string | null;
  privateBalanceAfter: string | null;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
  lastInteractedAt: string;
  submittedAt: string | null;
  rows: PayoutRowDraft[];
};
