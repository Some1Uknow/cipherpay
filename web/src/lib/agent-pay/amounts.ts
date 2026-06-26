import { decimalAmountToBaseUnits } from "@/lib/cloak/amounts";

export const AGENT_PAY_SOL_DECIMALS = 9;
export const AGENT_PAY_MIN_SOL = 0.01;

export function solInputToBaseUnits(value: string) {
  const trimmed = value.trim();
  const amount = Number(trimmed);
  if (!Number.isFinite(amount) || amount < AGENT_PAY_MIN_SOL) {
    throw new Error(`Amount must be at least ${AGENT_PAY_MIN_SOL} SOL.`);
  }
  return decimalAmountToBaseUnits(trimmed, AGENT_PAY_SOL_DECIMALS).toString();
}

export function optionalSolInputToBaseUnits(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;
  return solInputToBaseUnits(trimmed);
}

export function formatBaseUnits(baseUnits: string | null | undefined, decimals = AGENT_PAY_SOL_DECIMALS) {
  if (!baseUnits) return "0";
  const value = BigInt(baseUnits);
  const divisor = BigInt(10) ** BigInt(decimals);
  const whole = value / divisor;
  const fraction = value % divisor;
  const fractionText = fraction.toString().padStart(decimals, "0").replace(/0+$/, "");
  return fractionText ? `${whole}.${fractionText}` : whole.toString();
}
