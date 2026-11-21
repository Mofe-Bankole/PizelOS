import { num, px } from "../../tokens/read";
import { onTierChange, tier } from "./quality";

const SVG_NS = "http://www.w3.org/2000/svg";
let defs: SVGDefsElement | null = null;
let counter = 0;

export const refractionSupported = () => {
  const brands = (navigator as Navigator & { userAgentData?: { brands: { brand: string }[] } }).userAgentData?.brands;
  return !!brands?.some(b => b.brand === "Chromium");
};

function ensureDefs() {
  if (defs) return defs;
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("aria-hidden", "true");
  svg.style.cssText = "position:absolute;width:0;height:0;overflow:hidden;pointer-events:none";
  defs = document.createElementNS(SVG_NS, "defs");
  svg.appendChild(defs);
  document.body.appendChild(svg);
  return defs;
}

function displacementMap(w: number, h: number, radius: number, bezel: number): string {
  const scale = Math.min(1, 512 / Math.max(w, h));
  const cw = Math.max(2, Math.round(w * scale));
  const ch = Math.max(2, Math.round(h * scale));
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(cw, ch);
  const r = Math.min(radius, w / 2, h / 2);
  const hx = w / 2 - r;
  const hy = h / 2 - r;
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const px_ = (x + 0.5) / scale - w / 2;
      const py_ = (y + 0.5) / scale - h / 2;
      const qx = Math.abs(px_) - hx;
      const qy = Math.abs(py_) - hy;
      let nx = 0;
      let ny = 0;
      let dist: number;
      if (qx > 0 && qy > 0) {
        const len = Math.hypot(qx, qy) || 1;
        dist = r - len;
        nx = (qx / len) * Math.sign(px_);
        ny = (qy / len) * Math.sign(py_);
      } else if (qx > qy) {
        dist = r - qx;
        nx = Math.sign(px_);
      } else {
        dist = r - qy;
        ny = Math.sign(py_);
      }
      let m = 0;
      if (dist > 0 && dist < bezel) {
        const t = 1 - dist / bezel;
        m = 1 - Math.sqrt(1 - t * t);
      }
      const i = (y * cw + x) * 4;
      img.data[i] = 128 - nx * m * 127;
      img.data[i + 1] = 128 - ny * m * 127;
      img.data[i + 2] = 128;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL();
}

export interface LiquidOptions {
  radius?: number;
  bezel?: number;
  strength?: number;
  blur?: number;
}

export function liquefy(el: HTMLElement, options: LiquidOptions = {}) {
  if (!refractionSupported()) return () => {};
  const id = `liquid-${++counter}`;
  const host = ensureDefs();
  let filter: SVGFilterElement | null = null;
  let size = "";

  function build() {
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    if (!w || !h) return;
    const key = `${w}x${h}`;
    if (key === size && filter) return;
    size = key;
    const radius = options.radius ?? (parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0);
    const bezel = options.bezel ?? px("--liquid-bezel");
    const strength = options.strength ?? num("--liquid-strength");
    filter?.remove();
    filter = document.createElementNS(SVG_NS, "filter");
    filter.id = id;
    filter.setAttribute("x", "0");
    filter.setAttribute("y", "0");
    filter.setAttribute("width", String(w));
    filter.setAttribute("height", String(h));
    filter.setAttribute("filterUnits", "userSpaceOnUse");
    filter.setAttribute("color-interpolation-filters", "sRGB");
    const image = document.createElementNS(SVG_NS, "feImage");
    image.setAttribute("href", displacementMap(w, h, radius, bezel));
    image.setAttribute("x", "0");
    image.setAttribute("y", "0");
    image.setAttribute("width", String(w));
    image.setAttribute("height", String(h));
    image.setAttribute("preserveAspectRatio", "none");
    image.setAttribute("result", "map");
    const disp = document.createElementNS(SVG_NS, "feDisplacementMap");
    disp.setAttribute("in", "SourceGraphic");
    disp.setAttribute("in2", "map");
    disp.setAttribute("scale", String(strength));
    disp.setAttribute("xChannelSelector", "R");
    disp.setAttribute("yChannelSelector", "G");
    filter.append(image, disp);
    host.appendChild(filter);
    apply();
  }

  function apply() {
    if (tier() !== "high" || !filter) {
      el.style.removeProperty("backdrop-filter");
      el.style.removeProperty("-webkit-backdrop-filter");
      el.classList.remove("is-liquid");
      return;
    }
    const blur = options.blur ?? px("--liquid-blur");
    const value = `url(#${id}) blur(${blur}px) saturate(var(--glass-saturate)) brightness(var(--glass-brightness))`;
    el.style.setProperty("backdrop-filter", value);
    el.style.setProperty("-webkit-backdrop-filter", value);
    el.classList.add("is-liquid");
  }

  const observer = new ResizeObserver(() => build());
  observer.observe(el);
  const off = onTierChange(apply);
  build();

  return () => {
    observer.disconnect();
    off();
    filter?.remove();
    el.style.removeProperty("backdrop-filter");
    el.classList.remove("is-liquid");
  };
}
