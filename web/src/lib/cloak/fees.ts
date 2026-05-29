export const CLOAK_FIXED_FEE_LAMPORTS = BigInt(5_000_000);
export const CLOAK_VARIABLE_FEE_NUMERATOR = BigInt(3);
export const CLOAK_VARIABLE_FEE_DENOMINATOR = BigInt(1000);

export type CloakSolWithdrawalQuote = {
  grossLamports: bigint;
  fixedFeeLamports: bigint;
  variableFeeLamports: bigint;
  totalFeeLamports: bigint;
  netLamports: bigint;
  isSufficient: boolean;
};

export function quoteCloakSolWithdrawal(grossLamports: bigint): CloakSolWithdrawalQuote {
  const fixedFeeLamports = CLOAK_FIXED_FEE_LAMPORTS;
  const variableFeeLamports = (grossLamports * CLOAK_VARIABLE_FEE_NUMERATOR) / CLOAK_VARIABLE_FEE_DENOMINATOR;
  const totalFeeLamports = fixedFeeLamports + variableFeeLamports;
  const netLamports = grossLamports > totalFeeLamports ? grossLamports - totalFeeLamports : BigInt(0);

  return {
    grossLamports,
    fixedFeeLamports,
    variableFeeLamports,
    totalFeeLamports,
    netLamports,
    isSufficient: grossLamports > totalFeeLamports,
  };
}

export function quoteCloakSolWithdrawals(grossLamports: bigint[]) {
  return grossLamports.reduce(
    (summary, amount) => {
      const quote = quoteCloakSolWithdrawal(amount);
      return {
        grossLamports: summary.grossLamports + quote.grossLamports,
        fixedFeeLamports: summary.fixedFeeLamports + quote.fixedFeeLamports,
        variableFeeLamports: summary.variableFeeLamports + quote.variableFeeLamports,
        totalFeeLamports: summary.totalFeeLamports + quote.totalFeeLamports,
        netLamports: summary.netLamports + quote.netLamports,
        allSufficient: summary.allSufficient && quote.isSufficient,
      };
    },
    {
      grossLamports: BigInt(0),
      fixedFeeLamports: BigInt(0),
      variableFeeLamports: BigInt(0),
      totalFeeLamports: BigInt(0),
      netLamports: BigInt(0),
      allSufficient: true,
    },
  );
}
