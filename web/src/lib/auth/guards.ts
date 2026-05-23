export type SessionUser = {
  userId: string;
  walletAddress: string;
};

export type OrganizationRole = "owner" | "finance_admin" | "viewer";

export const canManageRecipients = (role: OrganizationRole): boolean => {
  return role === "owner" || role === "finance_admin";
};

export const canManageInvoices = (role: OrganizationRole): boolean => {
  return role === "owner" || role === "finance_admin";
};

export const canExecuteBatches = (role: OrganizationRole): boolean => {
  return role === "owner";
};
