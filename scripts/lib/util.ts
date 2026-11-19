import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";

export function slugify(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function hashFile(file: string): Promise<string> {
  const h = createHash("sha1");
  for await (const chunk of createReadStream(file)) h.update(chunk);
  return h.digest("hex").slice(0, 8);
}

export function hashBuffer(buf: Uint8Array): string {
  return createHash("sha1").update(buf).digest("hex").slice(0, 8);
}

export async function exists(p: string): Promise<boolean> {
  try { await fs.access(p); return true; } catch { return false; }
}

/** Normalise ag-psd pixel data (8/16/32-bit) to an 8-bit RGBA Buffer. */
export function toRGBA8(data: ArrayLike<number> & { buffer: ArrayBufferLike; byteOffset: number; byteLength: number }): Buffer {
  if (data instanceof Uint8ClampedArray || data instanceof Uint8Array) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  }
  const out = Buffer.alloc(data.length);
  if (data instanceof Uint16Array) {
    for (let i = 0; i < data.length; i++) out[i] = data[i] >> 8;
  } else {
    for (let i = 0; i < data.length; i++) out[i] = Math.max(0, Math.min(255, Math.round(data[i] * 255)));
  }
  return out;
}

export const titleCase = (s: string) => s.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim().replace(/\b\w/g, c => c.toUpperCase());

export const fmtMs = (ms: number) => (ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`);
