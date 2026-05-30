import bs58 from "bs58";
import nacl from "tweetnacl";

export type SiwsChallengeParams = {
  domain: string;
  address: string;
  statement: string;
  nonce: string;
  issuedAt: string;
  expiresAt: string;
  uri?: string;
  chain?: string;
};

export type SiwsSignInInput = {
  domain: string;
  address: string;
  statement: string;
  uri: string;
  version: "1";
  chainId: string;
  nonce: string;
  issuedAt: string;
  expirationTime: string;
};

export class SiwsMessage {
  readonly domain: string;
  readonly address: string;
  readonly statement: string;
  readonly nonce: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly uri?: string;
  readonly chain?: string;

  constructor(params: SiwsChallengeParams) {
    this.domain = params.domain;
    this.address = params.address;
    this.statement = params.statement;
    this.nonce = params.nonce;
    this.issuedAt = params.issuedAt;
    this.expiresAt = params.expiresAt;
    this.uri = params.uri;
    this.chain = params.chain;
  }

  toString(): string {
    const lines = [
      `${this.domain} wants you to sign in with your Solana account:`,
      this.address,
      "",
      this.statement,
      "",
      `URI: ${this.uri ?? this.domain}`,
      `Version: 1`,
      `Chain: ${this.chain ?? "solana"}`,
      `Nonce: ${this.nonce}`,
      `Issued At: ${this.issuedAt}`,
      `Expiration Time: ${this.expiresAt}`,
    ];

    return lines.join("\n");
  }

  toStandardString(): string {
    const lines = [
      `${this.domain} wants you to sign in with your Solana account:`,
      this.address,
      "",
      this.statement,
      "",
      `URI: ${this.uri ?? this.domain}`,
      `Version: 1`,
      `Chain ID: ${this.chain ?? "solana"}`,
      `Nonce: ${this.nonce}`,
      `Issued At: ${this.issuedAt}`,
      `Expiration Time: ${this.expiresAt}`,
    ];

    return lines.join("\n");
  }

  toSignInInput(): SiwsSignInInput {
    return {
      domain: this.domain,
      address: this.address,
      statement: this.statement,
      uri: this.uri ?? this.domain,
      version: "1",
      chainId: this.chain ?? "solana",
      nonce: this.nonce,
      issuedAt: this.issuedAt,
      expirationTime: this.expiresAt,
    };
  }

  validateDomain(expectedDomain: string): boolean {
    return this.domain === expectedDomain;
  }

  async verifySignature(signature: string, signedMessage?: Uint8Array): Promise<boolean> {
    try {
      const messageBytes = signedMessage ?? new TextEncoder().encode(this.toString());
      const signatureBytes = bs58.decode(signature);
      const publicKeyBytes = bs58.decode(this.address);

      return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
    } catch {
      return false;
    }
  }
}
