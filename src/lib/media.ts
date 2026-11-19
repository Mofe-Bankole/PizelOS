/**
 * Read side of the asset pipeline: looks up pieces in src/data/media.json
 * (written by `npm run assets`) and builds URLs for them.
 */
import data from "../data/media.json";

export interface Variant { w: number; src: string }
export interface LayerItem { name: string; src: string; x: number; y: number; w: number; h: number; opacity: number; blend?: string }
export interface MediaItem {
  id: string;
  width: number;
  height: number;
  thumbhash: string;
  color: string;
  variants: { avif: Variant[]; webp: Variant[] };
  layers?: { canvas: { w: number; h: number }; items: LayerItem[]; warnings: string[] };
}

const items = data.items as unknown as Record<string, MediaItem>;

// Local dev serves public/media; production points this at the R2/CDN domain.
const BASE = (import.meta.env.PUBLIC_MEDIA_BASE ?? "/media").replace(/\/$/, "");

export const mediaUrl = (src: string) => `${BASE}/${src.split("/").map(encodeURIComponent).join("/")}`;

export function getMedia(id: string): MediaItem {
  const m = items[id];
  if (!m) throw new Error(`No media for "${id}". Run \`npm run assets\` or check the id.`);
  return m;
}

export const findMedia = (id: string): MediaItem | undefined => items[id];

export const allMedia = () => Object.values(items);

export const srcset = (vs: Variant[]) => vs.map(v => `${mediaUrl(v.src)} ${v.w}w`).join(", ");

/** The smallest variant at least `w` wide (or the largest available). */
export function pick(vs: Variant[], w: number): Variant {
  return vs.find(v => v.w >= w) ?? vs[vs.length - 1];
}
