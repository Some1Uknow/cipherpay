#!/usr/bin/env node

const serverInfo = {
  name: "cipherpay-mcp",
  version: "0.1.0",
};

const SOLANA_ADDRESS_PATTERN = /[1-9A-HJ-NP-Za-km-z]{32,44}/;
const AMOUNT_PATTERN = /(?:amount|pay|total|due|for|send)?\s*(?:[:=-]\s*)?(?:SOL\s*)?(\d+(?:\.\d+)?)\s*(?:SOL)?/i;
const AMOUNT_FRAGMENT_PATTERN = /\b\d+(?:\.\d+)?\s*(?:SOL)?\b/i;

let inputBuffer = Buffer.alloc(0);

function parsePayableInstructions(instructions) {
  return String(instructions)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const walletAddress = line.match(SOLANA_ADDRESS_PATTERN)?.[0] ?? "";
      const amount = line.match(AMOUNT_PATTERN)?.[1] ?? "";
      const recipientChunk = walletAddress ? line.slice(0, line.indexOf(walletAddress)) : line;
      const recipientName = recipientChunk
        .replace(/^pay\s+/i, "")
        .replace(AMOUNT_FRAGMENT_PATTERN, "")
        .replace(/\b(?:send|transfer|amount|invoice|inv|to|for|by|due)\b.*$/i, "")
        .replace(/[,:=-]+$/g, "")
        .trim();

      return {
        recipientName: recipientName || "Unresolved recipient",
        walletAddress,
        amount,
      };
    });
}

function getConfig(args = {}) {
  const appUrl = String(args.appUrl ?? process.env.CIPHERPAY_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const walletAddress = String(args.walletAddress ?? process.env.CIPHERPAY_WALLET_ADDRESS ?? "").trim();
  const token = String(args.mcpToken ?? process.env.CIPHERPAY_MCP_TOKEN ?? process.env.MCP_API_TOKEN ?? "").trim();

  if (!walletAddress) {
    throw new Error("walletAddress is required. Pass it to the tool or set CIPHERPAY_WALLET_ADDRESS.");
  }

  if (!token) {
    throw new Error("MCP token is required. Pass mcpToken or set CIPHERPAY_MCP_TOKEN.");
  }

  return { appUrl, walletAddress, token };
}

async function createPayoutDraft(args = {}) {
  const { appUrl, walletAddress, token } = getConfig(args);
  const rows = Array.isArray(args.rows) ? args.rows : parsePayableInstructions(args.instructions ?? "");

  if (rows.length === 0) {
    throw new Error("No payout rows found.");
  }

  const response = await fetch(`${appUrl}/api/mcp/payout-drafts`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      walletAddress,
      entryMode: args.entryMode,
      rows,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error ?? `CipherPay API returned ${response.status}.`);
  }

  return payload;
}

const tools = [
  {
    name: "parse_payable_instructions",
    description: "Parse natural language payment instructions into CipherPay payout rows without creating a draft.",
    inputSchema: {
      type: "object",
      properties: {
        instructions: {
          type: "string",
          description: "One payment per line, including recipient, amount, and Solana recipient wallet.",
        },
      },
      required: ["instructions"],
    },
  },
  {
    name: "create_payout_draft",
    description: "Create a real CipherPay payout draft from structured rows. The user still approves execution in CipherPay.",
    inputSchema: {
      type: "object",
      properties: {
        walletAddress: { type: "string", description: "Funding wallet that has already signed into CipherPay." },
        rows: {
          type: "array",
          items: {
            type: "object",
            properties: {
              recipientName: { type: "string" },
              walletAddress: { type: "string" },
              amount: { type: "string" },
              clientRefId: { type: "string" },
            },
            required: ["recipientName", "walletAddress", "amount"],
          },
        },
        entryMode: { type: "string", enum: ["manual", "csv"] },
        appUrl: { type: "string" },
        mcpToken: { type: "string" },
      },
      required: ["rows"],
    },
  },
  {
    name: "draft_payment_from_instructions",
    description: "Parse natural language payment instructions and create a real CipherPay payout draft for wallet approval.",
    inputSchema: {
      type: "object",
      properties: {
        walletAddress: { type: "string", description: "Funding wallet that has already signed into CipherPay." },
        instructions: {
          type: "string",
          description: "One payment per line, including recipient, amount, and Solana recipient wallet.",
        },
        entryMode: { type: "string", enum: ["manual", "csv"] },
        appUrl: { type: "string" },
        mcpToken: { type: "string" },
      },
      required: ["instructions"],
    },
  },
];

function jsonContent(value) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}

async function handleRequest(message) {
  switch (message.method) {
    case "initialize":
      return {
        protocolVersion: message.params?.protocolVersion ?? "2024-11-05",
        capabilities: {
          tools: {},
        },
        serverInfo,
      };
    case "tools/list":
      return { tools };
    case "tools/call": {
      const { name, arguments: args = {} } = message.params ?? {};

      if (name === "parse_payable_instructions") {
        return jsonContent({ rows: parsePayableInstructions(args.instructions ?? "") });
      }

      if (name === "create_payout_draft" || name === "draft_payment_from_instructions") {
        const draft = await createPayoutDraft(args);
        return jsonContent({
          runId: draft.run?.id,
          entryMode: draft.run?.entryMode,
          status: draft.run?.status,
          itemCount: draft.run?.itemCount,
          totalAmount: draft.run?.totalAmount,
          assetSymbol: draft.run?.assetSymbol,
          approvalUrl: draft.approvalUrl,
          nextAction: draft.nextAction,
        });
      }

      throw new Error(`Unknown tool: ${name}`);
    }
    case "ping":
      return {};
    default:
      return {};
  }
}

function writeMessage(message) {
  const body = JSON.stringify(message);
  process.stdout.write(`Content-Length: ${Buffer.byteLength(body, "utf8")}\r\n\r\n${body}`);
}

function writeResponse(id, result) {
  writeMessage({ jsonrpc: "2.0", id, result });
}

function writeError(id, error) {
  writeMessage({
    jsonrpc: "2.0",
    id,
    error: {
      code: -32000,
      message: error instanceof Error ? error.message : "MCP server error.",
    },
  });
}

async function dispatch(message) {
  if (message.id === undefined || message.id === null) return;

  try {
    const result = await handleRequest(message);
    writeResponse(message.id, result);
  } catch (error) {
    writeError(message.id, error);
  }
}

function drainInputBuffer() {
  while (true) {
    const headerEnd = inputBuffer.indexOf("\r\n\r\n");
    if (headerEnd === -1) return;

    const header = inputBuffer.slice(0, headerEnd).toString("utf8");
    const lengthMatch = header.match(/Content-Length:\s*(\d+)/i);
    if (!lengthMatch) {
      inputBuffer = Buffer.alloc(0);
      return;
    }

    const contentLength = Number(lengthMatch[1]);
    const bodyStart = headerEnd + 4;
    const bodyEnd = bodyStart + contentLength;
    if (inputBuffer.length < bodyEnd) return;

    const rawBody = inputBuffer.slice(bodyStart, bodyEnd).toString("utf8");
    inputBuffer = inputBuffer.slice(bodyEnd);

    void dispatch(JSON.parse(rawBody));
  }
}

process.stdin.on("data", (chunk) => {
  inputBuffer = Buffer.concat([inputBuffer, chunk]);
  drainInputBuffer();
});

process.stdin.resume();
