export type AgentPolicyMode = "approval_required" | "autonomous";
export type AgentStatus = "active" | "revoked" | "archived";
export type AgentLinkRequestStatus = "pending" | "approved" | "rejected" | "expired";
export type AgentFundingRequestStatus = "pending" | "approved" | "dismissed" | "funded" | "cancelled";
export type AgentInvoiceStatus = "open" | "paid" | "cancelled" | "dismissed";
export type AgentApprovalStatus = "pending" | "approved" | "rejected" | "expired" | "executed";

export type LinkedAgent = {
  id: string;
  handle: string;
  displayName: string;
  ownerWalletAddress: string;
  agentWalletAddress: string;
  shieldedBalanceBaseUnits: string;
  assetSymbol: string;
  assetDecimals: number;
  policyMode: AgentPolicyMode;
  perTxLimitBaseUnits: string | null;
  rolling24hLimitBaseUnits: string | null;
  publicWithdrawalsEnabled: boolean;
  status: AgentStatus;
  linkedAt: string;
  updatedAt: string;
};

export type AgentLinkRequest = {
  id: string;
  proposedHandle: string;
  proposedName: string;
  agentWalletAddress: string;
  agentViewingPublicKey: string | null;
  backupAttestedAt: string | null;
  status: AgentLinkRequestStatus;
  createdAt: string;
};

export type AgentFundingRequest = {
  id: string;
  agentId: string;
  agentHandle: string;
  requestedAmountInput: string | null;
  requestedAmountBaseUnits: string | null;
  note: string | null;
  status: AgentFundingRequestStatus;
  createdAt: string;
};

export type AgentApprovalRequest = {
  id: string;
  agentId: string;
  agentHandle: string;
  kind: "payment" | "invoice_payment" | "public_withdrawal" | "policy_change";
  amountBaseUnits: string | null;
  feeBaseUnits: string | null;
  target: string | null;
  summary: string | null;
  status: AgentApprovalStatus;
  expiresAt: string;
  createdAt: string;
};

export type AgentInvoice = {
  id: string;
  invoiceNumber: string;
  issuerAgentId: string;
  issuerHandle: string;
  recipientAgentId: string | null;
  recipientHandle: string | null;
  humanPaymentSlug: string | null;
  payerWalletAddress: string | null;
  amountInput: string;
  amountBaseUnits: string;
  assetSymbol: string;
  title: string;
  description: string | null;
  externalRef: string | null;
  status: AgentInvoiceStatus;
  dueAt: string | null;
  paidAt: string | null;
  createdAt: string;
};

export type AgentActivity = {
  id: string;
  agentId: string | null;
  agentHandle: string | null;
  eventType: string;
  amountBaseUnits: string | null;
  assetSymbol: string;
  counterparty: string | null;
  status: string;
  summary: string | null;
  createdAt: string;
};

export type AgentPayOverview = {
  agents: LinkedAgent[];
  pendingLinks: AgentLinkRequest[];
  fundingRequests: AgentFundingRequest[];
  approvals: AgentApprovalRequest[];
  invoices: AgentInvoice[];
  activity: AgentActivity[];
};
