export type SignMessage = (message: Uint8Array) => Promise<Uint8Array>;

export function createMemoizedSignMessage(signMessage: SignMessage): SignMessage {
  const cache = new Map<string, Uint8Array>();

  return async (message: Uint8Array) => {
    const key = bytesToHex(message);
    const cached = cache.get(key);
    if (cached) return cached;

    const signature = await signMessage(message);
    cache.set(key, signature);
    return signature;
  };
}

function bytesToHex(bytes: Uint8Array) {
  let output = "";
  for (let index = 0; index < bytes.length; index += 1) {
    output += bytes[index].toString(16).padStart(2, "0");
  }
  return output;
}

