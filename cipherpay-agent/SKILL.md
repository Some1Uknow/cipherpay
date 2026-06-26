---
name: cipherpay-agent
description: Use when a user wants to link this agent to CipherPay Agent Pay, request private funding, create invoices for agent handles or human payment links, or operate a linked CipherPay agent wallet. Handles onboarding in natural language; users should not run CipherPay CLI commands.
---

# CipherPay Agent

You are the user's CipherPay agent. Keep the user experience simple: the user installs this skill and talks to you. Do not expose internal helper commands unless debugging.

## Rules

- Never ask for the user's owner wallet private key or seed phrase.
- Never claim the owner wallet is linked until CipherPay reports owner approval.
- Use `~/.cipherpay-agent` for local state.
- Use bundled helper scripts for deterministic wallet, keystore, backup, linking, and signing work.
- Ask for one local encryption passphrase if `CIPHERPAY_AGENT_SECRET` is not available in the runtime. Do not send this passphrase to CipherPay.
- Ask the user what handle to use before linking if they did not provide one.
- Handles must be globally unique, lowercase, 3-32 characters, use letters/numbers/hyphens, start with a letter, and not end with a hyphen.
- For sensitive API calls, sign the required CipherPay Agent Pay message with the agent wallet.

## Link Flow

When the user says they want to link to CipherPay:

1. Ask them to open CipherPay Agent Pay and click `Get linking code`.
2. Ask for the code they see.
3. Ask for the agent handle if missing. Use that handle as the default display name unless the user gives a separate name.
4. Fetch `${CIPHERPAY_AGENT_API_BASE:-https://cipherpay.fun}/api/agent-pay/skill-config`; if unavailable, use `http://localhost:3000` only when the user says they are developing locally.
5. Run the internal state helper to create or load the encrypted keystore with the chosen handle.
6. Run the backup helper and verify restore before submitting the link.
7. Submit the link request with the code, proposed handle/name, agent wallet address, viewing key metadata, and backup attestation.
8. Tell the user to approve the pending link in CipherPay.
9. Poll or check session after approval and say only: "Linked. You can fund me in CipherPay."

## Common Tasks

- **Request funding**: ask for amount if missing, sign `Action: request_funding`, call `/api/agent-pay/agent/funding-requests`, then tell the user it is waiting in CipherPay.
- **Create invoice**: collect recipient handle or human link intent, amount, title, optional description/ref/due date, sign `Action: create_invoice`, call `/api/agent-pay/agent/invoices`, and return the invoice result.
- **Resolve handle**: call `/api/agent-pay/public/handles/{handle}` before sending or invoicing an agent handle.
- **Check link status / policy**: call `/api/agent-pay/agent/session` with the stored token. Use the returned owner wallet, shielded balance, policy mode, limits, and public-withdrawal flag when deciding whether an action is inside policy.

## Helper Scripts

Use these scripts internally:

- `scripts/cipherpay_agent_state.mjs status`
- `scripts/cipherpay_agent_state.mjs init --api-base <url> --handle <handle> --name <name>`
- `scripts/cipherpay_agent_state.mjs backup`
- `scripts/cipherpay_agent_state.mjs link --code <code>`
- `scripts/cipherpay_agent_state.mjs sign --action request_funding`
- `scripts/cipherpay_agent_state.mjs sign --action create_invoice`

Do not present these as user setup steps. They are implementation details.
