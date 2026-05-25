const { decimalAmountToBaseUnits, formatBaseUnits } = require("../web/src/lib/magicblock/amounts");

describe("MagicBlock private payout amounts", () => {
  it("converts SOL display amounts to base units exactly", () => {
    expect(decimalAmountToBaseUnits("1", 9).toString()).toBe("1000000000");
    expect(decimalAmountToBaseUnits("0.000000001", 9).toString()).toBe("1");
    expect(decimalAmountToBaseUnits("12.340000000", 9).toString()).toBe("12340000000");
  });

  it("rejects invalid or over-precise amounts", () => {
    expect(() => decimalAmountToBaseUnits("0", 9)).toThrow("greater than zero");
    expect(() => decimalAmountToBaseUnits("-1", 9)).toThrow("greater than zero");
    expect(() => decimalAmountToBaseUnits("0.0000000001", 9)).toThrow("up to 9 decimal places");
    expect(() => decimalAmountToBaseUnits("1.2.3", 9)).toThrow("valid decimal");
  });

  it("formats base units without floating point math", () => {
    expect(formatBaseUnits("1000000000", 9)).toBe("1");
    expect(formatBaseUnits("12340000000", 9)).toBe("12.34");
    expect(formatBaseUnits("1", 9)).toBe("0.000000001");
  });
});
