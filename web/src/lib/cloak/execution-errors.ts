export class CloakExecutionNotImplementedError extends Error {
  constructor(flow: "manual-pay" | "bulk-pay") {
    super(`${flow} Cloak execution is not implemented yet.`);
    this.name = "CloakExecutionNotImplementedError";
  }
}

