export function decimalAmountToBaseUnits(amount: string, decimals: number): bigint {
  const trimmed = amount.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error("Amount must be a positive decimal number.");
  }

  const [whole, fractional = ""] = trimmed.split(".");
  if (fractional.length > decimals) {
    throw new Error(`Amount supports up to ${decimals} decimal places.`);
  }

  const paddedFractional = fractional.padEnd(decimals, "0");
  return BigInt(whole) * BigInt(10) ** BigInt(decimals) + BigInt(paddedFractional || "0");
}

export function sumBaseUnitAmounts(amounts: bigint[]): bigint {
  return amounts.reduce((sum, amount) => sum + amount, BigInt(0));
}

export function formatBaseUnits(amount: string | bigint, decimals: number): string {
  const value = typeof amount === "bigint" ? amount : BigInt(amount);
  const divisor = BigInt(10) ** BigInt(decimals);
  const whole = value / divisor;
  const fractional = value % divisor;

  if (fractional === BigInt(0)) return whole.toString();

  return `${whole.toString()}.${fractional.toString().padStart(decimals, "0").replace(/0+$/, "")}`;
}
