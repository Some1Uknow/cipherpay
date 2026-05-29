import { PublicKey } from "@solana/web3.js";
import type { Utxo, UtxoKeypair } from "@cloak.dev/sdk";

export type SerializedCloakUtxo = {
  amount: string;
  blinding: string;
  mintAddress: string;
  index?: number;
  commitment?: string;
  nullifier?: string;
  siblingCommitment?: string;
  keypair: {
    privateKey: string;
    publicKey: string;
  };
};

export function serializeCloakUtxo(utxo: Utxo): SerializedCloakUtxo {
  return {
    amount: utxo.amount.toString(),
    blinding: utxo.blinding.toString(16),
    mintAddress: utxo.mintAddress.toBase58(),
    index: utxo.index,
    commitment: utxo.commitment?.toString(16),
    nullifier: utxo.nullifier?.toString(16),
    siblingCommitment: utxo.siblingCommitment?.toString(16),
    keypair: {
      privateKey: utxo.keypair.privateKey.toString(16),
      publicKey: utxo.keypair.publicKey.toString(16),
    },
  };
}

export function deserializeCloakUtxo(serialized: SerializedCloakUtxo): Utxo {
  return {
    amount: BigInt(serialized.amount),
    blinding: hexToBigint(serialized.blinding),
    mintAddress: new PublicKey(serialized.mintAddress),
    index: serialized.index,
    commitment: serialized.commitment ? hexToBigint(serialized.commitment) : undefined,
    nullifier: serialized.nullifier ? hexToBigint(serialized.nullifier) : undefined,
    siblingCommitment: serialized.siblingCommitment ? hexToBigint(serialized.siblingCommitment) : undefined,
    keypair: deserializeUtxoKeypair(serialized.keypair),
  };
}

export function serializeUtxoKeypair(keypair: UtxoKeypair) {
  return {
    privateKey: keypair.privateKey.toString(16),
    publicKey: keypair.publicKey.toString(16),
  };
}

export function deserializeUtxoKeypair(serialized: SerializedCloakUtxo["keypair"]): UtxoKeypair {
  return {
    privateKey: hexToBigint(serialized.privateKey),
    publicKey: hexToBigint(serialized.publicKey),
  };
}

function hexToBigint(value: string) {
  return BigInt(value.startsWith("0x") ? value : `0x${value}`);
}

