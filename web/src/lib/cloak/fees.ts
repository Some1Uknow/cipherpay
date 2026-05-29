import { FIXED_FEE_LAMPORTS, VARIABLE_FEE_DENOMINATOR, VARIABLE_FEE_NUMERATOR, calculateFeeBigint, isWithdrawAmountSufficient } from "@cloak.dev/sdk";

export type CloakSolWithdrawalQuote = {
  grossLamports: bigint;
  fixedFeeLamports: bigint;
  variableFeeLamports: bigint;
  totalFeeLamports: bigint;
  netLamports: bigint;
  isSufficient: boolean;
};

export function quoteCloakSolWithdrawal(grossLamports: bigint): CloakSolWithdrawalQuote {
  const fixedFeeLamports = BigInt(FIXED_FEE_LAMPORTS);
  const variableFeeLamports = (grossLamports * BigInt(VARIABLE_FEE_NUMERATOR)) / BigInt(VARIABLE_FEE_DENOMINATOR);
  const totalFeeLamports = calculateFeeBigint(grossLamports);
  const netLamports = grossLamports > totalFeeLamports ? grossLamports - totalFeeLamports : BigInt(0);

  return {
    grossLamports,
    fixedFeeLamports,
    variableFeeLamports,
    totalFeeLamports,
    netLamports,
    isSufficient: isWithdrawAmountSufficient(grossLamports),
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

