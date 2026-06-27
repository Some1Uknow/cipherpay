export const INVITE_COOKIE_NAME = "cipherpay_invite";
export const INVITE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export const isInviteGateEnabled = (): boolean => Boolean(process.env.INVITE_CODE?.trim());

export const inviteCookieValue = async (inviteCode: string): Promise<string> => {
  const data = new TextEncoder().encode(inviteCode.trim());
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

export const isValidInviteCode = (value: string): boolean => {
  const inviteCode = process.env.INVITE_CODE?.trim();
  return Boolean(inviteCode && value.trim() === inviteCode);
};

