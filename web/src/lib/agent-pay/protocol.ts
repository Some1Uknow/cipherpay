export const AGENT_PAY_API_VERSION = "2026-06-25";
export const AGENT_PAY_SKILL_NAME = "cipherpay-agent";
export const AGENT_PAY_SKILL_INSTALL = "npx skills add Some1Uknow/cipherpay";
export const AGENT_PAY_LOCAL_STATE_DIR = "~/.cipherpay-agent";

export const agentSignedMessageTemplates = {
  requestFunding: [
    "CipherPay Agent Pay",
    "Action: request_funding",
    "Agent: <agent-wallet-address>",
    "Timestamp: <iso-8601>",
  ].join("\n"),
  createInvoice: [
    "CipherPay Agent Pay",
    "Action: create_invoice",
    "Agent: <agent-wallet-address>",
    "Timestamp: <iso-8601>",
  ].join("\n"),
} as const;
