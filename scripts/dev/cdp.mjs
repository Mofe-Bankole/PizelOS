import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const sleep = ms => new Promise(r => setTimeout(r, ms));

export async function launch({ width = 1920, height = 1080, dpr = 1, port = 9333, bin = process.env.BROWSER ?? "brave" } = {}) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "cdp-profile-"));
  const proc = spawn(bin, ["--headless=new", "--hide-scrollbars", `--user-data-dir=${profile}`, "--no-first-run", `--window-size=${width},${height}`, `--remote-debugging-port=${port}`, "about:blank"], { stdio: "ignore" });
  let wsUrl;
  for (let i = 0; i < 60 && !wsUrl; i++) {
    await sleep(250);
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      wsUrl = list.find(t => t.type === "page")?.webSocketDebuggerUrl;
    } catch {}
  }
  if (!wsUrl) throw new Error("browser did not start");
  const ws = new WebSocket(wsUrl);
  await new Promise(r => ws.addEventListener("open", r));
  let id = 0;
  const pending = new Map();
  const logs = [];
  ws.addEventListener("message", e => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      pending.get(m.id)(m);
      pending.delete(m.id);
    }
    if (m.method === "Runtime.exceptionThrown") logs.push("EXCEPTION " + (m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text));
    if (m.method === "Runtime.consoleAPICalled") logs.push(m.params.type + " " + m.params.args.map(a => a.value ?? a.description).join(" "));
  });
  const send = (method, params = {}) =>
    new Promise(r => {
      const i = ++id;
      pending.set(i, r);
      ws.send(JSON.stringify({ id: i, method, params }));
    });
  await send("Runtime.enable");
  await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: dpr, mobile: false });

  return {
    logs,
    send,
    sleep,
    async goto(url, wait = 2500) {
      await send("Page.navigate", { url });
      await sleep(wait);
    },
    async eval(expr) {
      const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
      if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description ?? "eval failed");
      return r.result.result.value;
    },
    move: (x, y) => send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y }),
    async click(x, y) {
      await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
      await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
      await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
    },
    async shot(file, clip) {
      const r = await send("Page.captureScreenshot", { format: "png", ...(clip ? { clip: { ...clip, scale: 1 } } : {}) });
      fs.writeFileSync(file, Buffer.from(r.result.data, "base64"));
    },
    close() {
      ws.close();
      proc.kill();
      setTimeout(() => fs.rmSync(profile, { recursive: true, force: true }), 500);
    },
  };
}
