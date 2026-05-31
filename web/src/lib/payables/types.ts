export type PayableCadence = "weekly" | "monthly" | "one_time";

export type PayableRecord = {
  id: string;
  userId: string;
  recipientName: string;
  walletAddress: string;
  amount: string;
  cadence: PayableCadence;
  nextDueOn: string;
  memo: string | null;
  active: boolean;
  lastDraftedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
