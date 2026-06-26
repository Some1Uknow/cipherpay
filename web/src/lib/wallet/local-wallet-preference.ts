"use client";

export const CIPHERPAY_WALLET_NAME_KEY = "cipherpay.walletName";

export function clearStoredWalletPreference() {
  try {
    window.localStorage.removeItem(CIPHERPAY_WALLET_NAME_KEY);
  } catch {
    // Ignore storage failures. Wallet modal can still open normally.
  }
}
