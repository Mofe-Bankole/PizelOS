/**
 * Asset pipeline: artwork/ (originals) → public/media/ (web versions) + src/data/media.json
 *
 *   npm run assets                 process everything new or changed
 *   npm run assets -- ads          only pieces whose id starts with "ads"
 *   npm run assets -- --force      ignore the cache and redo everything
 *
 * Each piece = files in the same folder sharing a base name ("Malaria ad.png" + "Malaria ad.psd").
 * The PNG/JPG is used for the flat image when present; otherwise the PSD's composite.
 * PSDs listed in assets.config.json "layered" are also split into layers for the breakdown.
 * A stub info file is created in src/content/works/ for every new piece (never overwritten).
 */
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import pLimit from "p-limit";
import { rgbaToThumbHash } from "thumbhash";
import { extractLayers, readComposite } from "./lib/psd.ts";
import { exists, fmtMs, hashBuffer, hashFile, slugify, titleCase } from "./lib/util.ts";

sharp.cache(false);

const ROOT = path.resolve(import.meta.dirname, "..");
const cfg = JSON.parse(await fs.readFile(path.join(ROOT, "assets.config.json"), "utf8"));
const SRC = path.join(ROOT, cfg.source);
const OUT = path.join(ROOT, cfg.out);
const DATA = path.join(ROOT, cfg.data);
const CONTENT = path.join(ROOT, cfg.content);
const PROJECTS = path.join(ROOT, cfg.projects);

const args = process.argv.slice(2);
const force = args.includes("--force");
const only = args.find(a => !a.startsWith("--"));

// ---------- types ----------
interface SourceInfo { file: string; size: number; mtimeMs: number; hash: string }
interface Variant { w: number; src: string }
interface MediaItem {
  id: string;
  source: SourceInfo;
  width: number; height: number;
  thumbhash: string; color: string;
  variants: { avif: Variant[]; webp: Variant[] };
  layers?: {
    source: SourceInfo;
    canvas: { w: number; h: number };
    items: { name: string; src: string; x: number; y: number; w: number; h: number; opacity: number; blend?: string }[];
    warnings: string[];
  };
}
interface Piece { id: string; folder: string; name: string; flat?: string; psd?: string }

// ---------- scan ----------
const IMG = new Set([".png", ".jpg", ".jpeg"]);
const ignore = new Set<string>(cfg.ignoreExtensions);
const skipped: { file: string; reason: string }[] = [];
const pieces = new Map<string, Piece>();

for (const rel of (await fs.readdir(SRC, { recursive: true })).sort()) {
  const abs = path.join(SRC, rel);
  if (path.basename(rel).startsWith(".") || !(await fs.stat(abs)).isFile()) continue;
  const ext = path.extname(rel).toLowerCase();
  if (ignore.has(ext)) { skipped.push({ file: rel, reason: `ignored ${ext}` }); continue; }
  if (!IMG.has(ext) && ext !== ".psd") { skipped.push({ file: rel, reason: `unsupported ${ext}` }); continue; }

  const folder = path.dirname(rel);
  const name = path.basename(rel, path.extname(rel)).trim();
  const id = [...folder.split(path.sep).filter(s => s !== "."), name].map(slugify).join("/");
  const p = pieces.get(id) ?? { id, folder, name };
  if (ext === ".psd") p.psd = abs;
  else if (!p.flat || ext === ".png") p.flat = abs;   // prefer PNG over JPG
  pieces.set(id, p);
}

// ---------- load previous run ----------
const prev: Record<string, MediaItem> = (await exists(DATA))
  ? JSON.parse(await fs.readFile(DATA, "utf8")).items ?? {}
  : {};
const items: Record<string, MediaItem> = {};
const errors: { id: string; error: string }[] = [];
const todo = [...pieces.values()].filter(p => !only || p.id.startsWith(only));

// Keep untouched entries when running on a subset.
for (const p of pieces.values()) if (prev[p.id] && !todo.includes(p)) items[p.id] = prev[p.id];

let saving = Promise.resolve();
const save = () => (saving = saving.then(async () => {
  await fs.mkdir(path.dirname(DATA), { recursive: true });
  const sorted = Object.fromEntries(Object.entries(items).sort(([a], [b]) => a.localeCompare(b)));
  await fs.writeFile(DATA, JSON.stringify({ generatedAt: new Date().toISOString(), base: "/media", items: sorted, skipped }, null, 2));
}));

// PSDs can be 400MB+ and decode to several GB; never run two at once.
const imgLimit = pLimit(cfg.concurrency);
const psdLimit = pLimit(1);
let done = 0;

await Promise.all(todo.map(p => {
  const heavy = !p.flat || cfg.layered.includes(p.id);
  return (heavy ? psdLimit : imgLimit)(async () => {
    const t0 = Date.now();
    try {
      const item = await processPiece(p, prev[p.id]);
      items[p.id] = item;
      await stubContent(p);
      await save();
      const tag = item === prev[p.id] ? "cached" : fmtMs(Date.now() - t0);
      console.log(`[${++done}/${todo.length}] ${p.id}  ${tag}${item.layers ? `  (${item.layers.items.length} layers)` : ""}`);
      item.layers?.warnings.forEach(w => console.log(`      ⚠ ${w}`));
    } catch (e) {
      errors.push({ id: p.id, error: (e as Error).message });
      console.log(`[${++done}/${todo.length}] ${p.id}  ✗ ${(e as Error).message}`);
    }
  });
}));

if (!only) await pruneOrphans();
await save();

console.log(`\n${Object.keys(items).length} pieces in ${path.relative(ROOT, DATA)}`);
if (skipped.length) console.log(`${skipped.length} files skipped: ${skipped.map(s => s.file).join(", ")}`);
if (errors.length) {
  console.log(`\n${errors.length} errors:`);
  errors.forEach(e => console.log(`  ${e.id}: ${e.error}`));
  process.exitCode = 1;
}

// ---------- per piece ----------
async function processPiece(p: Piece, old?: MediaItem): Promise<MediaItem> {
  const flatFile = p.flat ?? p.psd!;
  const st = await fs.stat(flatFile);
  const rel = path.relative(SRC, flatFile);
  const wantLayers = cfg.layered.includes(p.id) && p.psd;

  const flatFresh = !force && old && old.source.file === rel && old.source.size === st.size
    && old.source.mtimeMs === st.mtimeMs && await exists(path.join(OUT, old.variants.webp[0].src));
  const layersFresh = !wantLayers || (!force && old?.layers && await sameSource(p.psd!, old.layers.source));
  if (flatFresh && layersFresh && (wantLayers || !old!.layers)) return old!;

  let item: MediaItem;
  let psdBuf: Buffer | undefined;

  if (flatFresh) {
    item = { ...old!, layers: undefined };
  } else {
    let input: sharp.Sharp, width: number, height: number, hash: string;
    if (p.flat) {
      hash = await hashFile(p.flat);
      const m = await sharp(p.flat, { limitInputPixels: false }).metadata();
      const swap = (m.orientation ?? 1) >= 5;
      width = swap ? m.height! : m.width!;
      height = swap ? m.width! : m.height!;
      input = sharp(p.flat, { limitInputPixels: false }).rotate();
    } else {
      psdBuf = await fs.readFile(p.psd!);
      hash = hashBuffer(psdBuf);
      const comp = readComposite(psdBuf);
      if (!comp) throw new Error(`PSD has no flattened preview. Re-save it with "Maximize PSD Compatibility" on, or export a PNG next to it`);
      ({ width, height } = comp);
      input = sharp(comp.data, { raw: { width, height, channels: 4 }, limitInputPixels: false });
    }

    const dir = path.join(OUT, p.id);
    await clearFiles(dir);
    await fs.mkdir(dir, { recursive: true });

    const widths = [...new Set((cfg.widths as number[]).map(w => Math.min(w, width)))];
    const variants: MediaItem["variants"] = { avif: [], webp: [] };
    for (const w of widths) {
      const resized = input.clone().resize({ width: w, withoutEnlargement: true });
      for (const fmt of ["avif", "webp"] as const) {
        const src = `${p.id}/${w}.${hash}.${fmt}`;
        await resized.clone()[fmt](cfg[fmt]).toFile(path.join(OUT, src));
        variants[fmt].push({ w, src });
      }
    }

    const tiny = await input.clone().resize(100, 100, { fit: "inside" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const thumbhash = Buffer.from(rgbaToThumbHash(tiny.info.width, tiny.info.height, tiny.data)).toString("base64");
    const { dominant: d } = await input.clone().stats();
    const color = "#" + [d.r, d.g, d.b].map(v => v.toString(16).padStart(2, "0")).join("");

    item = {
      id: p.id,
      source: { file: rel, size: st.size, mtimeMs: st.mtimeMs, hash },
      width, height, thumbhash, color, variants,
    };
  }

  if (wantLayers) {
    item.layers = layersFresh && old?.layers ? old.layers : await processLayers(p, psdBuf);
  }
  return item;
}

async function processLayers(p: Piece, buf?: Buffer): Promise<NonNullable<MediaItem["layers"]>> {
  const st = await fs.stat(p.psd!);
  buf ??= await fs.readFile(p.psd!);
  const hash = hashBuffer(buf);
  const { canvas, layers, warnings } = extractLayers(buf);
  const scale = Math.min(1, cfg.layerMaxSize / Math.max(canvas.w, canvas.h));
  const dir = path.join(OUT, p.id, "layers");
  await fs.rm(dir, { recursive: true, force: true });
  await fs.mkdir(dir, { recursive: true });

  const pct = (v: number, of: number) => +((v / of) * 100).toFixed(3);
  const out = [];
  for (const [i, l] of layers.entries()) {
    const src = `${p.id}/layers/${String(i + 1).padStart(2, "0")}-${slugify(l.name) || "layer"}.${hash}.webp`;
    await sharp(l.rgba, { raw: { width: l.width, height: l.height, channels: 4 } })
      .resize({ width: Math.max(1, Math.round(l.width * scale)) })
      .webp({ quality: 85, alphaQuality: 90 })
      .toFile(path.join(OUT, src));
    out.push({
      name: l.name, src,
      x: pct(l.left, canvas.w), y: pct(l.top, canvas.h), w: pct(l.width, canvas.w), h: pct(l.height, canvas.h),
      opacity: l.opacity, ...(l.blend ? { blend: l.blend } : {}),
    });
  }
  return { source: { file: path.relative(SRC, p.psd!), size: st.size, mtimeMs: st.mtimeMs, hash }, canvas, items: out, warnings };
}

// ---------- helpers ----------
async function sameSource(file: string, s: SourceInfo) {
  const st = await fs.stat(file);
  return st.size === s.size && st.mtimeMs === s.mtimeMs;
}

async function clearFiles(dir: string) {
  if (!(await exists(dir))) return;
  for (const e of await fs.readdir(dir, { withFileTypes: true })) if (e.isFile()) await fs.rm(path.join(dir, e.name));
}

// Blank info files; see src/content.config.ts for what each field means.
function workStub(title: string) {
  return {
    title,
    client: "",
    tweet: "",
    year: null,
    categories: [],
    description: "",
    award: null,
    stats: null,
    featured: false,
    hidden: false,
    order: 0,
  };
}

function projectStub(folder: string) {
  return {
    name: titleCase(folder),
    kind: /bounty/i.test(folder) ? "bounty" : /contest|entry/i.test(folder) ? "contest" : "client",
    x: "",
    website: "",
    description: "",
    award: null,
    order: 0,
    hidden: false,
  };
}

async function writeIfMissing(file: string, data: object) {
  if (await exists(file)) return;
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(data, null, 2) + "\n");
}

async function stubContent(p: Piece) {
  await writeIfMissing(path.join(CONTENT, `${p.id}.json`), workStub(p.name));
  const folder = p.folder.split(path.sep)[0];
  if (folder !== ".") await writeIfMissing(path.join(PROJECTS, `${slugify(folder)}.json`), projectStub(folder));
}

async function pruneOrphans() {
  if (!(await exists(OUT))) return;
  for (const folder of await fs.readdir(OUT)) {
    const fdir = path.join(OUT, folder);
    if (!(await fs.stat(fdir)).isDirectory()) continue;
    for (const piece of await fs.readdir(fdir)) {
      if (!items[`${folder}/${piece}`]) {
        await fs.rm(path.join(fdir, piece), { recursive: true, force: true });
        console.log(`  removed stale output ${folder}/${piece}`);
      }
    }
  }
}
