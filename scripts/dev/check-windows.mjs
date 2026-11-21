import { launch } from "./cdp.mjs";

const out = process.argv[2] ?? ".";
const base = process.argv[3] ?? "http://localhost:4400";
const b = await launch();
const rect = sel => b.eval(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
const state = () => b.eval(`({ path: location.pathname, windows: [...document.querySelectorAll('#desktop > .window')].map(w => w.dataset.window + (w.hidden ? '(min)' : '') + (w.classList.contains('is-focused') ? '*' : '')).join(','), running: [...document.querySelectorAll('.dock-item.is-running')].map(d => d.dataset.app).join(','), app: document.querySelector('[data-menu=app]').textContent.trim() })`);
const log = async label => console.log(label.padEnd(28), JSON.stringify(await state()));
const click = async sel => { const r = await rect(sel); if (!r) throw new Error("missing " + sel); await b.click(r.x, r.y); };
const dbl = async sel => {
  const r = await rect(sel);
  if (!r) throw new Error("missing " + sel);
  for (const count of [1, 2]) {
    await b.send("Input.dispatchMouseEvent", { type: "mousePressed", x: r.x, y: r.y, button: "left", clickCount: count });
    await b.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: r.x, y: r.y, button: "left", clickCount: count });
  }
};

await b.goto(base + "/?boot=0");
await log("start");
await click('.dock-item[data-app="work"] .dock-button'); await b.sleep(1200);
await log("dock → Work"); await b.shot(`${out}/w1-work.png`);
await dbl('.finder-grid.is-folders .finder-link'); await b.sleep(1200);
await log("dblclick first folder"); await b.shot(`${out}/w2-folder.png`);
await dbl('.finder-grid:not(.is-folders) .finder-link'); await b.sleep(1500);
await log("dblclick first piece"); await b.shot(`${out}/w3-preview.png`);
await b.send("Input.dispatchKeyEvent", { type: "keyDown", key: "ArrowRight", code: "ArrowRight", windowsVirtualKeyCode: 39 });
await b.send("Input.dispatchKeyEvent", { type: "keyUp", key: "ArrowRight", code: "ArrowRight", windowsVirtualKeyCode: 39 });
await b.sleep(1200);
await log("ArrowRight in Preview");
const before = await b.eval(`document.querySelector('.window[data-window=preview]').style.transform`);
const t = await rect('.window[data-window=preview] .window-toolbar');
await b.move(t.x + 120, t.y);
await b.send("Input.dispatchMouseEvent", { type: "mousePressed", x: t.x + 120, y: t.y, button: "left", clickCount: 1 });
for (let i = 1; i <= 10; i++) { await b.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: t.x + 120 - i * 25, y: t.y + i * 6, button: "left", buttons: 1 }); await b.sleep(16); }
await b.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: t.x - 130, y: t.y + 60, button: "left", clickCount: 1 });
await b.sleep(200);
console.log("drag preview".padEnd(28), before, "→", await b.eval(`document.querySelector('.window[data-window=preview]').style.transform`));
for (const app of ["layers", "gallery", "trophies", "about", "contact", "trash"]) {
  await click(`.dock-item[data-app="${app}"] .dock-button`);
  await b.sleep(app === "layers" ? 3500 : 1300);
  await log(`dock → ${app}`);
  await b.shot(`${out}/w-${app}.png`);
}
await click('.window.is-focused [data-window-action="close"]'); await b.sleep(500);
await log("close focused (trash)");
await click('.window.is-focused [data-window-action="minimize"]'); await b.sleep(600);
await log("minimize focused");
await click('.dock-item[data-app="contact"] .dock-button'); await b.sleep(900);
await log("dock → restore contact");
await b.eval(`history.back()`); await b.sleep(1200);
await log("history.back()");
await b.goto(base + "/work/magic-eden?boot=0", 2500);
await log("direct load /work/magic-eden");
await b.shot(`${out}/w-direct.png`);
console.log("page errors:", JSON.stringify(b.logs));
b.close();
process.exit(0);
