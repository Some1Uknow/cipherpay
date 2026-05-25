const U64_MAX = BigInt("18446744073709551615");

export function decimalAmountToBaseUnits(amount: string, decimals: number): bigint {
  const trimmed = amount.trim();
  if (!trimmed || trimmed.startsWith("-")) {
    throw new Error("Amount must be greater than zero.");
  }

  const [whole = "0", fraction = ""] = trimmed.split(".");
  if (!/^\d+$/.test(whole) || !/^\d*$/.test(fraction) || trimmed.split(".").length > 2) {
    throw new Error("Amount must be a valid decimal value.");
  }
  if (fraction.length > decimals) {
    throw new Error(`Amount supports up to ${decimals} decimal places.`);
  }

  const scale = BigInt(10) ** BigInt(decimals);
  const paddedFraction = fraction.padEnd(decimals, "0");
  const baseUnits = BigInt(whole) * scale + BigInt(paddedFraction || "0");
  if (baseUnits <= BigInt(0)) {
    throw new Error("Amount must be greater than zero.");
  }
  if (baseUnits > U64_MAX) {
    throw new Error("Amount is too large for a Solana token amount.");
  }

  return baseUnits;
}

export function sumBaseUnitAmounts(amounts: bigint[]): bigint {
  return amounts.reduce((sum, amount) => sum + amount, BigInt(0));
}

export function formatBaseUnits(baseUnits: string | bigint | null | undefined, decimals: number): string {
  if (baseUnits == null) return "0";
  const value = typeof baseUnits === "bigint" ? baseUnits : BigInt(baseUnits);
  const scale = BigInt(10) ** BigInt(decimals);
  const whole = value / scale;
  const fraction = value % scale;
  if (fraction === BigInt(0)) return whole.toString();

  const fractionText = fraction.toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${whole.toString()}.${fractionText}`;
}
