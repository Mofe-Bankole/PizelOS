import agPsd from "ag-psd";
import type { Layer, Psd } from "ag-psd";
import { toRGBA8 } from "./util.ts";

const { readPsd, initializeCanvas } = agPsd;

// ag-psd allocates 8-bit pixel buffers through a <canvas>, which Node doesn't have.
// We only need raw pixels, so hand it plain arrays instead. A real canvas is only
// needed to decode JPEG thumbnails, which we skip, so createCanvas just explains itself.
initializeCanvas(
  () => { throw new Error("ag-psd needed a real canvas (JPEG thumbnail?); pass skipThumbnail: true"); },
  (width, height) => ({ width, height, data: new Uint8ClampedArray(width * height * 4), colorSpace: "srgb" }) as ImageData,
);

export interface RawImage { data: Buffer; width: number; height: number }

/** Read only the flattened composite (fast: layer pixels are skipped). */
export function readComposite(buf: Buffer): RawImage | null {
  const psd = readPsd(buf, { useImageData: true, skipLayerImageData: true, skipThumbnail: true });
  if (!psd.imageData) return null;
  return { data: toRGBA8(psd.imageData.data as any), width: psd.width, height: psd.height };
}

/** Read the layer tree without decoding any pixels. */
export function readStructure(buf: Buffer): Psd {
  return readPsd(buf, { skipLayerImageData: true, skipCompositeImageData: true, skipThumbnail: true });
}

// CSS mix-blend-mode equivalents of Photoshop blend modes.
const CSS_BLEND: Record<string, string> = {
  "normal": "normal", "pass through": "normal", "multiply": "multiply", "screen": "screen",
  "overlay": "overlay", "darken": "darken", "lighten": "lighten", "color dodge": "color-dodge",
  "color burn": "color-burn", "hard light": "hard-light", "soft light": "soft-light",
  "difference": "difference", "exclusion": "exclusion", "hue": "hue", "saturation": "saturation",
  "color": "color", "luminosity": "luminosity", "linear dodge": "plus-lighter",
};

export interface ExtractedLayer {
  name: string;
  rgba: Buffer;            // trimmed pixels
  left: number; top: number; width: number; height: number;  // px on the full canvas
  opacity: number;
  blend?: string;
}

export interface Extracted {
  canvas: { w: number; h: number };
  composite: RawImage | null;
  layers: ExtractedLayer[];
  warnings: string[];
}

/**
 * Flatten each visible top-level layer/group into its own trimmed RGBA image.
 *
 * Groups are composited here with normal "over" blending, so things Photoshop does
 * inside a group (adjustment layers, clipping masks, inner blend modes, layer
 * effects) can't be reproduced. Those are reported as warnings. The fix on the
 * design side: convert each top-level group to a Smart Object, which stores the
 * fully rendered pixels.
 */
export function extractLayers(buf: Buffer): Extracted {
  const psd = readPsd(buf, { useImageData: true, skipThumbnail: true });
  const W = psd.width, H = psd.height;
  const warnings = new Set<string>();
  const layers: ExtractedLayer[] = [];

  for (const node of psd.children ?? []) {
    if (node.hidden) continue;
    const name = node.name?.trim() || "Layer";
    if (node.adjustment) { warnings.add(`"${name}": top-level adjustment layer skipped`); continue; }

    const canvas = new Uint8ClampedArray(W * H * 4);
    if (node.children) {
      renderGroup(node, canvas, W, H, 1, warnings, name);
    } else {
      noteLost(node, warnings, name, true);
      blit(node, canvas, W, H, 1);
    }

    const box = alphaBounds(canvas, W, H);
    if (!box) { warnings.add(`"${name}": empty, skipped`); continue; }

    const blendKey = node.blendMode ?? "normal";
    const blend = CSS_BLEND[blendKey];
    if (!blend) warnings.add(`"${name}": blend mode "${blendKey}" has no CSS equivalent, using normal`);

    layers.push({
      name,
      rgba: crop(canvas, W, box),
      ...box,
      opacity: node.opacity ?? 1,
      ...(blend && blend !== "normal" ? { blend } : {}),
    });
  }

  if (layers.length > 8) warnings.add(`${layers.length} top-level layers; 3–6 groups reads best in the breakdown`);

  const composite = psd.imageData
    ? { data: toRGBA8(psd.imageData.data as any), width: W, height: H }
    : null;

  return { canvas: { w: W, h: H }, composite, layers, warnings: [...warnings] };
}

function renderGroup(group: Layer, canvas: Uint8ClampedArray, W: number, H: number, opacity: number, warnings: Set<string>, top: string) {
  const op = opacity * (group.opacity ?? 1);
  for (const child of group.children ?? []) {     // ag-psd orders children bottom → top
    if (child.hidden) continue;
    if (child.adjustment) { warnings.add(`"${top}": adjustment layer "${child.name}" can't be rendered`); continue; }
    if (child.children) { renderGroup(child, canvas, W, H, op, warnings, top); continue; }
    noteLost(child, warnings, top, false);
    blit(child, canvas, W, H, op);
  }
}

function noteLost(l: Layer, warnings: Set<string>, top: string, isTop: boolean) {
  if (l.clipping) warnings.add(`"${top}": clipping mask on "${l.name}" ignored`);
  if (l.effects && !l.effects.disabled) warnings.add(`"${top}": layer effects on "${l.name}" (shadow/stroke/glow) not rendered`);
  const bm = l.blendMode ?? "normal";
  if (!isTop && bm !== "normal" && bm !== "pass through") warnings.add(`"${top}": blend mode "${bm}" on "${l.name}" flattened as normal`);
}

/** Straight-alpha "over" composite of one pixel layer (with its mask) onto the canvas. */
function blit(l: Layer, dst: Uint8ClampedArray, W: number, H: number, groupOpacity: number) {
  const img = l.imageData;
  if (!img) return;
  const src = toRGBA8(img.data as any);
  const sw = img.width, sh = img.height;
  const left = l.left ?? 0, top = l.top ?? 0;
  const op = groupOpacity * (l.opacity ?? 1) * (l.fillOpacity ?? 1);
  if (op <= 0) return;

  const m = l.mask && !l.mask.disabled && l.mask.imageData ? l.mask : null;
  const mData = m ? toRGBA8(m.imageData!.data as any) : null;
  const mL = m?.left ?? 0, mT = m?.top ?? 0, mW = m?.imageData?.width ?? 0, mH = m?.imageData?.height ?? 0;
  const mDefault = (m?.defaultColor ?? 255) / 255;

  for (let y = 0; y < sh; y++) {
    const dy = top + y;
    if (dy < 0 || dy >= H) continue;
    for (let x = 0; x < sw; x++) {
      const dx = left + x;
      if (dx < 0 || dx >= W) continue;
      const si = (y * sw + x) * 4;
      let sa = (src[si + 3] / 255) * op;
      if (mData) {
        const mx = dx - mL, my = dy - mT;
        sa *= mx >= 0 && my >= 0 && mx < mW && my < mH ? mData[(my * mW + mx) * 4] / 255 : mDefault;
      }
      if (sa <= 0) continue;
      const di = (dy * W + dx) * 4;
      const da = dst[di + 3] / 255;
      const oa = sa + da * (1 - sa);
      for (let c = 0; c < 3; c++) dst[di + c] = (src[si + c] * sa + dst[di + c] * da * (1 - sa)) / oa;
      dst[di + 3] = oa * 255;
    }
  }
}

function alphaBounds(px: Uint8ClampedArray, W: number, H: number) {
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) {
    const row = y * W * 4;
    for (let x = 0; x < W; x++) {
      if (px[row + x * 4 + 3] > 2) {
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
  }
  return x1 < 0 ? null : { left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
}

function crop(px: Uint8ClampedArray, W: number, b: { left: number; top: number; width: number; height: number }): Buffer {
  const out = Buffer.alloc(b.width * b.height * 4);
  for (let y = 0; y < b.height; y++) {
    const s = ((b.top + y) * W + b.left) * 4;
    out.set(px.subarray(s, s + b.width * 4), y * b.width * 4);
  }
  return out;
}
