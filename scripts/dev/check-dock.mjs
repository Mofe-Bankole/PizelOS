import { launch } from "./cdp.mjs";

const out = process.argv[2] ?? ".";
const url = process.argv[3] ?? "http://localhost:4400/";
const b = await launch();
await b.goto(url);

const plateRect = `(() => { const r = document.querySelector('.dock-plate').getBoundingClientRect(); return [+r.left.toFixed(2), +r.right.toFixed(2), +((r.left + r.right) / 2).toFixed(2), +r.width.toFixed(2)]; })()`;
const rest = await b.eval(plateRect);
console.log("rest       L, R, centre, width", JSON.stringify(rest));
const items = await b.eval(`[...document.querySelectorAll('.dock-item')].map(e => { const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })`);

let worst = 0;
for (const idx of [0, 3, items.length - 1]) {
  const [x, y] = items[idx];
  for (let k = 0; k < 6; k++) {
    await b.move(x - 30 + k * 6, y);
    await b.sleep(16);
  }
  await b.sleep(900);
  const r = await b.eval(plateRect);
  const left = rest[0] - r[0];
  const right = r[1] - rest[1];
  worst = Math.max(worst, Math.abs(left - right), Math.abs(r[2] - rest[2]));
  console.log(`hover #${idx}  L, R, centre, width`, JSON.stringify(r), ` grew left ${left.toFixed(2)}  right ${right.toFixed(2)}`);
  if (idx === 3) await b.shot(`${out}/dock-hover.png`);
}

await b.move(960, 400);
await b.sleep(1200);
const after = await b.eval(plateRect);
console.log("after leave", JSON.stringify(after), " transform:", JSON.stringify(await b.eval(`document.querySelector('.dock-plate').style.transform`)));
console.log("max asymmetry / centre drift (px):", worst.toFixed(3));
console.log("returned to rest:", JSON.stringify(after) === JSON.stringify(rest));
console.log("glass tier:", await b.eval(`document.documentElement.dataset.glass`), "| plate refraction:", await b.eval(`document.querySelector('.dock-plate').classList.contains('is-liquid')`));
await b.shot(`${out}/dock-rest.png`);
console.log("page errors:", JSON.stringify(b.logs));
b.close();
process.exit(0);
