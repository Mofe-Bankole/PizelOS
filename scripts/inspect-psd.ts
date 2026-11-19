/**
 * Look inside PSDs without processing them.
 *   npm run assets:inspect -- "artwork/ads/Malaria ad.psd"   → full layer tree
 *   npm run assets:inspect -- artwork                         → one-line summary per PSD
 */
import fs from "node:fs/promises";
import path from "node:path";
import type { Layer } from "ag-psd";
import { readStructure } from "./lib/psd.ts";

const target = process.argv[2];
if (!target) { console.error("usage: inspect-psd <file.psd | folder>"); process.exit(1); }

const stat = await fs.stat(target);
if (stat.isFile()) await tree(target);
else await summary(target);

async function tree(file: string) {
  const psd = readStructure(await fs.readFile(file));
  console.log(`${path.basename(file)}  ${psd.width}×${psd.height}  ${psd.bitsPerChannel ?? 8}-bit  colorMode=${psd.colorMode}\n`);
  const walk = (nodes: Layer[], depth: number) => {
    for (const l of [...nodes].reverse()) {       // print top → bottom like Photoshop
      const flags = [
        l.children ? "group" : l.adjustment ? "adjustment" : l.text ? "text" : l.placedLayer ? "smart-object" : "",
        l.hidden && "hidden", l.clipping && "clipped", l.mask && "mask",
        l.effects && !l.effects.disabled && "effects",
        l.blendMode && !["normal", "pass through"].includes(l.blendMode) && l.blendMode,
        (l.opacity ?? 1) < 1 && `${Math.round((l.opacity ?? 1) * 100)}%`,
      ].filter(Boolean).join(", ");
      console.log(`${"  ".repeat(depth)}${depth === 0 ? "■" : "·"} ${l.name}${flags ? `  [${flags}]` : ""}`);
      if (l.children) walk(l.children, depth + 1);
    }
  };
  walk(psd.children ?? [], 0);
}

async function summary(dir: string) {
  const files = (await fs.readdir(dir, { recursive: true }))
    .filter(f => f.toLowerCase().endsWith(".psd")).sort();
  console.log("top = visible top-level layers/groups (ideal for the breakdown: 3–6)\n");
  for (const rel of files) {
    const file = path.join(dir, rel);
    try {
      const { size } = await fs.stat(file);
      const psd = readStructure(await fs.readFile(file));
      const top = (psd.children ?? []).filter(l => !l.hidden);
      const groups = top.filter(l => l.children).length;
      let total = 0;
      const count = (ns: Layer[]) => ns.forEach(l => { total++; if (l.children) count(l.children); });
      count(psd.children ?? []);
      console.log(`${String(top.length).padStart(3)} top (${groups} groups) ${String(total).padStart(4)} total  ${`${psd.width}×${psd.height}`.padEnd(11)} ${`${Math.round(size / 1048576)}MB`.padStart(6)}  ${rel}`);
    } catch (e) {
      console.log(`  ERROR ${rel}: ${(e as Error).message}`);
    }
  }
}
