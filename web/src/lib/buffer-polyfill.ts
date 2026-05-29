"use client";

import { Buffer as BufferPolyfill } from "buffer";
// Next may inject its compiled Buffer for free Buffer references in browser bundles.
// Patch both implementations so Cloak dependencies can use readBigInt* methods.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore: Next's compiled buffer module has no public type declaration.
import { Buffer as CompiledBuffer } from "next/dist/compiled/buffer";

type BufferLike = Uint8Array & {
  buffer: ArrayBufferLike;
  byteOffset: number;
  byteLength: number;
};

function readBigInt64LE(this: BufferLike, offset = 0): bigint {
  if (offset < 0 || offset + 8 > this.byteLength) {
    throw new RangeError(`Offset ${offset} is outside buffer bounds.`);
  }
  return new DataView(this.buffer, this.byteOffset, this.byteLength).getBigInt64(offset, true);
}

function readBigUInt64LE(this: BufferLike, offset = 0): bigint {
  if (offset < 0 || offset + 8 > this.byteLength) {
    throw new RangeError(`Offset ${offset} is outside buffer bounds.`);
  }
  return new DataView(this.buffer, this.byteOffset, this.byteLength).getBigUint64(offset, true);
}

function patchBigIntMethods(bufferClass: { prototype: Record<string, unknown> }) {
  if (typeof bufferClass.prototype.readBigInt64LE !== "function") {
    bufferClass.prototype.readBigInt64LE = readBigInt64LE;
  }
  if (typeof bufferClass.prototype.readBigUInt64LE !== "function") {
    bufferClass.prototype.readBigUInt64LE = readBigUInt64LE;
  }
}

export function applyBufferPolyfill(): void {
  if (typeof window === "undefined") return;

  patchBigIntMethods(CompiledBuffer as unknown as { prototype: Record<string, unknown> });
  patchBigIntMethods(BufferPolyfill as unknown as { prototype: Record<string, unknown> });
  (globalThis as { Buffer?: unknown }).Buffer = BufferPolyfill;
}

