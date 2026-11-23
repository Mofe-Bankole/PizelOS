import { launch } from "./cdp.mjs";

const out = process.argv[2] ?? ".";
const base = process.argv[3] ?? "http://localhost:4400";
const b = await launch({ port: 9370 });
await b.goto(base + "/layers/durex-art/durex-fathers-day?boot=0&glass=medium", 4500);

const q = expr => b.eval(expr);
const stackT = () => q(`document.querySelector('[data-layers-stack]').style.transform`);
const planeT = i => q(`document.querySelectorAll('.layers-plane')[${i}].style.transform`);
const center = sel => q(`(() => { const r = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
const drag = async (x, y, dx, dy, modifiers = 0, button = "left") => {
  await b.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
  await b.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button, clickCount: 1, modifiers });
  for (let k = 1; k <= 8; k++) {
    await b.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: x + (dx * k) / 8, y: y + (dy * k) / 8, button, buttons: button === "left" ? 1 : 4, modifiers });
    await b.sleep(16);
  }
  await b.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: x + dx, y: y + dy, button, clickCount: 1, modifiers });
  await b.sleep(120);
};
const click = async (sel, modifiers = 0) => {
  const [x, y] = await center(sel);
  await b.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
  await b.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1, modifiers });
  await b.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1, modifiers });
  await b.sleep(150);
};
const selectedName = () => q(`document.querySelector('[data-layers-selected-name]').textContent`);
const ok = (label, cond, detail = "") => console.log(`${cond ? "PASS" : "FAIL"}  ${label}${detail ? "  — " + detail : ""}`);

const idx = 5;
const [ix, iy] = await center(`[data-layer-img="${idx}"]`);
const before = await planeT(idx);
await drag(ix, iy, 90, 40);
const picked = await selectedName();
const pickedIdx = await q(`[...document.querySelectorAll('.layers-plane')].findIndex(p => p.classList.contains('is-selected'))`);
const after = await planeT(pickedIdx);
ok("drag on a layer selects and moves it", pickedIdx >= 0 && after !== before, `selected "${picked}" (#${pickedIdx}): ${after}`);
ok("panel row highlights the selection", await q(`document.querySelector('[data-layer-row="${pickedIdx}"]').classList.contains('is-selected')`));
await b.shot(`${out}/layers-moved.png`);

const stage = await q(`(() => { const r = document.querySelector('[data-layers-stage]').getBoundingClientRect(); return [r.left + 30, r.top + 30]; })()`);
const s0 = await stackT();
await drag(stage[0], stage[1], 120, 30);
const s1 = await stackT();
ok("drag on background orbits", s0 !== s1, s1);

await b.send("Input.dispatchMouseEvent", { type: "mouseWheel", x: stage[0] + 200, y: stage[1] + 200, deltaX: 0, deltaY: -400 });
await b.sleep(150);
const s2 = await stackT();
ok("scroll zooms", s2 !== s1, s2.match(/scale\([^)]*\)/)?.[0]);

await b.send("Input.dispatchKeyEvent", { type: "keyDown", key: " ", code: "Space", windowsVirtualKeyCode: 32 });
await drag(stage[0], stage[1], 60, 50);
await b.send("Input.dispatchKeyEvent", { type: "keyUp", key: " ", code: "Space", windowsVirtualKeyCode: 32 });
const s3 = await stackT();
ok("space + drag pans", s3.startsWith("translate(60px"), s3.slice(0, 40));

await q(`(() => { const o = document.querySelector('[data-layers-opacity]'); o.value = '40'; o.dispatchEvent(new Event('input', { bubbles: true })); return 1 })()`);
const op = await q(`document.querySelector('[data-layer-img="${pickedIdx}"]').style.opacity`);
ok("opacity slider changes the selected layer", Number(op) < 0.5, `opacity ${op}`);

await click(`[data-layer-eye="2"]`, 1);
const vis = await q(`[...document.querySelectorAll('.layers-plane')].map(p => p.classList.contains('is-off') ? 0 : 1).join('')`);
ok("alt-click eye solos a layer", vis === [...Array(vis.length)].map((_, j) => (j === 2 ? 1 : 0)).join(""), vis);
await click(`[data-layer-eye="2"]`, 1);
ok("alt-click again shows all", (await q(`document.querySelectorAll('.layers-plane.is-off').length`)) === 0);
await b.shot(`${out}/layers-orbit-zoom.png`);

await click(`[data-layers-reset-layer]`);
await b.sleep(600);
ok("reset layer restores position and opacity", (await planeT(pickedIdx)).startsWith("translate3d(0px, 0px") && (await q(`document.querySelector('[data-layer-img="${pickedIdx}"]').style.opacity`)) === "1", await planeT(pickedIdx));

await click(`[data-layers-reset-view]`);
await b.sleep(600);
const sv = await stackT();
const nums = sv.match(/-?[\d.]+/g).map(Number);
ok("reset view restores camera", Math.abs(nums[0]) < 0.5 && Math.abs(nums[2] - 56) < 0.5 && Math.abs(nums[3] + 32) < 0.5 && Math.abs(nums[4] - 0.64) < 0.01, sv);

await drag(ix, iy, -50, 30);
const moved = await q(`[...document.querySelectorAll('.layers-plane')].filter(p => !p.style.transform.startsWith('translate3d(0px, 0px')).length`);
await click(`[data-layers-reset-all]`);
await b.sleep(600);
const still = await q(`[...document.querySelectorAll('.layers-plane')].filter(p => !p.style.transform.startsWith('translate3d(0px, 0px')).length`);
ok("reset all returns every layer", moved > 0 && still === 0, `${moved} moved → ${still} after reset`);

const [dx, dy] = await center(`[data-layer-img="${idx}"]`);
await drag(dx, dy, 40, 0);
const sel = await q(`[...document.querySelectorAll('.layers-plane')].findIndex(p => p.classList.contains('is-selected'))`);
const [cx, cy] = await center(`[data-layer-img="${sel}"]`);
await b.send("Input.dispatchMouseEvent", { type: "mousePressed", x: cx, y: cy, button: "left", clickCount: 1 });
await b.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: cx, y: cy, button: "left", clickCount: 1 });
await b.send("Input.dispatchMouseEvent", { type: "mousePressed", x: cx, y: cy, button: "left", clickCount: 2 });
await b.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: cx, y: cy, button: "left", clickCount: 2 });
await b.sleep(600);
ok("double-click a layer resets it", (await planeT(sel)).startsWith("translate3d(0px, 0px"), await planeT(sel));

await click(`[data-layers-play]`);
await b.sleep(2500);
const flat0 = await q(`document.querySelector('[data-layers-flat]').style.opacity`);
const [fx, fy] = await center(`[data-layer-img="${idx}"]`);
await drag(fx, fy, 70, 0);
const flat1 = await q(`document.querySelector('[data-layers-flat]').style.opacity`);
ok("collapsed view: moving a layer reveals the layers", Number(flat0) > 0.95 && flat1 === "0", `flat opacity ${flat0} → ${flat1}`);
await b.shot(`${out}/layers-collapsed-moved.png`);

console.log("page errors:", JSON.stringify(b.logs));
b.close();
process.exit(0);
