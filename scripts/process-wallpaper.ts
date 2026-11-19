import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { rgbaToThumbHash, thumbHashToDataURL } from "thumbhash";
import { hashFile, slugify } from "./lib/util.ts";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "public/wallpaper");
const DATA = path.join(ROOT, "src/data/wallpaper.json");
const WIDTHS = [1920, 2560, 3024, 3456, 3840, 5120];
const FORMATS = { avif: { quality: 60, effort: 4 }, webp: { quality: 84 }, jpeg: { quality: 86, mozjpeg: true } } as const;

const [input, appearance = "light"] = process.argv.slice(2);
if (!input) {
  console.error("usage: npm run wallpaper -- <image.heic|.jpg|.png|.svg> [light|dark]");
  process.exit(1);
}

const name = slugify(path.basename(input, path.extname(input)));
const ext = path.extname(input).toLowerCase();
let source = input;

if (ext === ".heic" || ext === ".heif") {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "wallpaper-"));
  source = path.join(tmp, `${name}.png`);
  execFileSync("heif-convert", ["-q", "100", input, source], { stdio: "inherit" });
  const extracted = (await fs.readdir(tmp)).filter(f => f.endsWith(".png")).sort();
  source = path.join(tmp, extracted[0]);
  if (extracted.length > 1) console.log(`HEIC holds ${extracted.length} images; using ${extracted[0]}. Others: ${extracted.slice(1).join(", ")}`);
}

const load = () => sharp(source, { limitInputPixels: false, density: ext === ".svg" ? 231 : undefined })
  .resize({ width: 5120, withoutEnlargement: ext !== ".svg" })
  .removeAlpha();

const master = await load().png().toBuffer({ resolveWithObject: true });
const { width, height } = master.info;
const hash = await hashFile(input);
const dir = path.join(OUT, name);
await fs.rm(dir, { recursive: true, force: true });
await fs.mkdir(dir, { recursive: true });

const variants: { w: number; avif: string; webp: string; jpeg: string }[] = [];
for (const w of WIDTHS.filter(w => w <= width)) {
  const resized = sharp(master.data).resize({ width: w });
  const entry = { w } as (typeof variants)[number];
  for (const [fmt, opts] of Object.entries(FORMATS) as [keyof typeof FORMATS, object][]) {
    const file = `${name}/${w}.${hash}.${fmt === "jpeg" ? "jpg" : fmt}`;
    await resized.clone().toFormat(fmt, opts).toFile(path.join(OUT, file));
    entry[fmt] = file;
  }
  variants.push(entry);
  console.log(`  ${w}px`);
}

const blurred = `${name}/blur.${hash}.webp`;
await sharp(master.data).resize({ width: 640 }).blur(14).modulate({ saturation: 1.5 }).webp({ quality: 70 }).toFile(path.join(OUT, blurred));

const tiny = await sharp(master.data).resize(100, 100, { fit: "inside" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const thumbhash = rgbaToThumbHash(tiny.info.width, tiny.info.height, tiny.data);
const placeholder = thumbHashToDataURL(thumbhash);
const { dominant } = await sharp(master.data).stats();
const color = "#" + [dominant.r, dominant.g, dominant.b].map(v => v.toString(16).padStart(2, "0")).join("");

const luminance = async (left: number, w: number) => {
  const strip = await sharp(master.data)
    .extract({ left, top: 0, width: w, height: Math.round(height * 0.03) })
    .resize(1, 1)
    .raw()
    .toBuffer();
  const [r, g, b] = [...strip].map(v => v / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const half = Math.round(width / 2);
const tone = (l: number) => (l > 0.6 ? "light" : "dark");
const menubar = { left: tone(await luminance(0, half)), right: tone(await luminance(half, width - half)) };

const existing = await fs.readFile(DATA, "utf8").then(JSON.parse).catch(() => ({ active: name, items: {} }));
existing.items[name] = {
  name,
  appearance,
  width,
  height,
  aspect: +(width / height).toFixed(5),
  color,
  placeholder,
  blurred,
  menubar,
  variants,
  source: path.relative(ROOT, path.resolve(input)),
};
existing.active ??= name;
await fs.mkdir(path.dirname(DATA), { recursive: true });
await fs.writeFile(DATA, JSON.stringify(existing, null, 2));
console.log(`${name}: ${variants.length} sizes, menu bar text over left/right = ${menubar.left === "light" ? "dark" : "light"}/${menubar.right === "light" ? "dark" : "light"}`);
