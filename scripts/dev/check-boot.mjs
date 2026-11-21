import { launch } from "./cdp.mjs";

const out = process.argv[2] ?? ".";
const base = process.argv[3] ?? "http://localhost:4400";

async function sampleBoot(b, label, shots = []) {
  const t0 = Date.now();
  const samples = [];
  let shot = 0;
  while (Date.now() - t0 < 6000) {
    const s = await b.eval(`({ mode: document.documentElement.dataset.boot, fill: (document.querySelector('.boot-fill')?.style.transform || '').replace(/[^0-9.]/g, '') })`);
    samples.push(`${Date.now() - t0}ms:${s.mode}${s.mode === "boot" ? "@" + (Number(s.fill) * 100 || 0).toFixed(0) + "%" : ""}`);
    if (shots[shot] !== undefined && Date.now() - t0 >= shots[shot]) await b.shot(`${out}/${label}-${shots[shot++]}ms.png`);
    if (s.mode === "none") break;
    await b.sleep(80);
  }
  console.log(`${label}:`, samples.filter((_, i) => i % 2 === 0 || i === samples.length - 1).join("  "));
  return Date.now() - t0;
}

const b = await launch({ port: 9340 });
await b.send("Page.navigate", { url: base + "/?glass=high" });
const bootMs = await sampleBoot(b, "first-visit", [250, 800]);
console.log("first visit boot took ~", bootMs, "ms");
console.log("after boot:", JSON.stringify(await b.eval(`({
  booted: localStorage.getItem('shell:booted'),
  wallpaper: document.querySelector('[data-wallpaper] img').src.slice(0, 5),
  wallpaperLoaded: document.querySelector('[data-wallpaper]').classList.contains('is-loaded'),
  interLoaded: document.fonts.check('13px "Inter Variable"'),
  menubarOpacity: getComputedStyle(document.querySelector('.menubar')).opacity
})`)));
await b.sleep(2500);
console.log("service worker:", JSON.stringify(await b.eval(`(async () => {
  const reg = await navigator.serviceWorker.getRegistration();
  const names = await caches.keys();
  const counts = {};
  for (const n of names) counts[n] = (await (await caches.open(n)).keys()).length;
  return { active: !!reg?.active, controlled: !!navigator.serviceWorker.controller, caches: counts };
})()`)));

await b.send("Page.navigate", { url: base + "/work?glass=high" });
await b.sleep(120);
await b.shot(`${out}/lock.png`);
const lockMs = await sampleBoot(b, "return-visit");
console.log("return visit lock took ~", lockMs, "ms; window:", await b.eval(`document.querySelector('#desktop > .window')?.dataset.window`));

await b.send("Page.navigate", { url: base + "/?lock=1&glass=high" });
await b.sleep(300);
await b.send("Input.dispatchKeyEvent", { type: "keyDown", key: "a", code: "KeyA", text: "a" });
await b.send("Input.dispatchKeyEvent", { type: "keyUp", key: "a", code: "KeyA" });
const t = Date.now();
while ((await b.eval(`document.documentElement.dataset.boot`)) !== "none" && Date.now() - t < 3000) await b.sleep(30);
console.log("key press unlock took ~", Date.now() - t + 300, "ms from load (auto-unlock is 900ms)");
console.log("errors (normal network):", JSON.stringify(b.logs));
b.close();

const slow = await launch({ port: 9341 });
await slow.send("Network.enable");
await slow.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: 400 * 1024, uploadThroughput: 200 * 1024 });
await slow.send("Page.navigate", { url: base + "/?glass=high" });
const slowMs = await sampleBoot(slow, "slow-400KBps");
console.log("slow network boot took ~", slowMs, "ms (cap 4000)");
console.log("errors (slow network):", JSON.stringify(slow.logs));
slow.close();
process.exit(0);
