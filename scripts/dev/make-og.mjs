import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { launch } from "./cdp.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const OUT = path.join(ROOT, "public/og");
const W = 1200;
const H = 630;
const media = JSON.parse(await fs.readFile(path.join(ROOT, "src/data/media.json"), "utf8")).items;
const only = process.argv.includes("--cards-only") ? "cards" : process.argv.includes("--home-only") ? "home" : "all";

await fs.mkdir(path.join(OUT, "work"), { recursive: true });

if (only !== "home") {
  const wanted = new Set();
  let made = 0;
  for (const [id, m] of Object.entries(media)) {
    const file = path.join(OUT, "work", `${id}.${m.source.hash}.jpg`);
    wanted.add(path.resolve(file));
    try {
      await fs.access(file);
      continue;
    } catch {}
    const src = path.join(ROOT, "public/media", m.variants.webp.at(-1).src);
    const bg = await sharp(src).resize(W, H, { fit: "cover" }).blur(38).modulate({ brightness: 0.55, saturation: 1.2 }).toBuffer();
    const fg = await sharp(src).resize(W - 80, H - 70, { fit: "inside" }).toBuffer({ resolveWithObject: true });
    await fs.mkdir(path.dirname(file), { recursive: true });
    await sharp(bg)
      .composite([{ input: fg.data, left: Math.round((W - fg.info.width) / 2), top: Math.round((H - fg.info.height) / 2) }])
      .jpeg({ quality: 82, mozjpeg: true })
      .toFile(file);
    made++;
  }
  for (const entry of await fs.readdir(path.join(OUT, "work"), { recursive: true, withFileTypes: true })) {
    const full = path.resolve(entry.parentPath, entry.name);
    if (entry.isFile() && !wanted.has(full)) await fs.rm(full);
  }
  console.log(`piece cards: ${made} new, ${wanted.size} total`);
}

if (only !== "cards") {
  const server = spawn("npx", ["astro", "preview", "--port", "4401"], { cwd: ROOT, stdio: "ignore", detached: true });
  try {
    for (let i = 0; i < 60; i++) {
      try {
        if ((await fetch("http://localhost:4401/og-card")).ok) break;
      } catch {}
      await new Promise(r => setTimeout(r, 500));
    }
    const b = await launch({ width: W, height: H, port: 9350 });
    await b.goto("http://localhost:4401/og-card", 2500);
    const png = path.join(OUT, "home.png");
    await b.shot(png, { x: 0, y: 0, width: W, height: H });
    b.close();
    await sharp(png).jpeg({ quality: 88, mozjpeg: true }).toFile(path.join(OUT, "pizelxx.jpg"));
    await fs.rm(png);
    console.log("home card: public/og/pizelxx.jpg");
  } finally {
    try {
      process.kill(-server.pid);
    } catch {}
    spawn("npx", ["astro", "preview", "stop"], { cwd: ROOT, stdio: "ignore" });
  }
}

const favicon = await fs.readFile(path.join(ROOT, "public/favicon.svg"));
await sharp(favicon, { density: 600 }).resize(180, 180).png().toFile(path.join(ROOT, "public/apple-touch-icon.png"));
console.log("apple-touch-icon.png");
process.exit(0);
