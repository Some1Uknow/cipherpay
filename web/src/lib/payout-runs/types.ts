export type PayoutRunEntryMode = "manual" | "csv";

export type PayoutRunStatus = "draft" | "ready" | "submitting" | "submitted" | "failed" | "completed";

export type PayoutRowDraft = {
  id: string;
  recipientName: string;
  walletAddress: string;
  amount: string;
  rowStatus?: "draft" | "ready" | "submitted" | "confirmed" | "failed";
  txSignature?: string | null;
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
  itemCount: number;
  createdAt: string;
  updatedAt: string;
  lastInteractedAt: string;
  submittedAt: string | null;
  rows: PayoutRowDraft[];
};
