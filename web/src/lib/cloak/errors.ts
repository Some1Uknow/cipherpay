import { CloakError, RootNotFoundError, UtxoAlreadySpentError, isRootNotFoundError } from "@cloak.dev/sdk";

export type CloakErrorKind =
  | "stale_root_retryable"
  | "relay_indexing_delay"
  | "wallet_rejected"
  | "insufficient_balance"
  | "proof_generation_failed"
  | "transaction_failed"
  | "recovery_required"
  | "configuration"
  | "unknown";

export type NormalizedCloakError = {
  kind: CloakErrorKind;
  title: string;
  message: string;
  retryable: boolean;
};

export function normalizeCloakError(error: unknown): NormalizedCloakError {
  if (error instanceof RootNotFoundError || isRootNotFoundError(error) || messageIncludes(error, ["rootnotfound", "root not found", "stale root"])) {
    return {
      kind: "stale_root_retryable",
      title: "Private pool moved ahead",
      message: "The proof used an old Merkle root. Regenerate the proof with a fresh pool snapshot and retry.",
      retryable: true,
    };
  }

  if (error instanceof UtxoAlreadySpentError || messageIncludes(error, ["already spent", "doublespend", "double spend"])) {
    return {
      kind: "recovery_required",
      title: "Private note already spent",
      message: "The local private note state is stale or was spent in another session. Refresh recovery state before retrying.",
      retryable: false,
    };
  }

  if (messageIncludes(error, ["user rejected", "wallet rejected", "declined", "signature request denied"])) {
    return {
      kind: "wallet_rejected",
      title: "Wallet rejected the request",
      message: getErrorMessage(error) || "The wallet signing request was rejected.",
      retryable: true,
    };
  }

  if (messageIncludes(error, ["insufficient", "0x1", "not enough"])) {
    return {
      kind: "insufficient_balance",
      title: "Insufficient balance",
      message: getErrorMessage(error) || "The funding wallet or private note does not have enough SOL.",
      retryable: false,
    };
  }

  if (error instanceof CloakError) {
    return normalizeCloakSdkError(error);
  }

  return {
    kind: "unknown",
    title: "Private payout failed",
    message: getErrorMessage(error) || "Unknown Cloak error.",
    retryable: false,
  };
}

function normalizeCloakSdkError(error: CloakError): NormalizedCloakError {
  if (error.category === "wallet") {
    return { kind: "wallet_rejected", title: "Wallet rejected the request", message: error.message, retryable: true };
  }
  if (error.category === "indexer") {
    return { kind: "relay_indexing_delay", title: "Relay is catching up", message: error.message, retryable: true };
  }
  if (error.category === "prover") {
    return { kind: "proof_generation_failed", title: "Proof generation failed", message: error.message, retryable: error.retryable };
  }
  if (error.category === "environment" || error.category === "validation") {
    return { kind: "configuration", title: "Cloak configuration issue", message: error.message, retryable: false };
  }
  if (error.category === "network" || error.category === "relay" || error.category === "service") {
    return { kind: "transaction_failed", title: "Cloak service unavailable", message: error.message, retryable: error.retryable };
  }
  return { kind: "unknown", title: "Private payout failed", message: error.message, retryable: error.retryable };
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "";
}

function messageIncludes(error: unknown, needles: string[]) {
  const message = getErrorMessage(error).toLowerCase();
  return needles.some((needle) => message.includes(needle));
}

