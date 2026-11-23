import { captions } from "./presets";

interface Sticker { ch: string; x: number; y: number; s: number; r: number }
type Style = "classic" | "bar";

const EMOJI = `"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
const BAR_FONT = `"Inter Variable", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif`;
const MAX_LINES = 3;

const shared = {
  top: "",
  bottom: "",
  style: "classic" as Style,
  size: 1,
  stickers: [] as Sticker[],
};

let impact: boolean | undefined;
function hasImpact() {
  if (impact !== undefined) return impact;
  const ctx = document.createElement("canvas").getContext("2d")!;
  const sample = "mmmmmmmmmmlliWW";
  ctx.font = "72px monospace";
  const base = ctx.measureText(sample).width;
  ctx.font = "72px Impact, monospace";
  impact = ctx.measureText(sample).width !== base;
  return impact;
}

const memeFont = (px: number) =>
  hasImpact() ? `${px}px Impact, Haettenschweiler, sans-serif` : `900 ${px}px "Inter Variable", "Arial Black", system-ui, sans-serif`;

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number) {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= maxW || !line) {
      line = next;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function fit(ctx: CanvasRenderingContext2D, text: string, maxW: number, start: number, font: (px: number) => string) {
  let px = start;
  for (;;) {
    ctx.font = font(px);
    const lines = wrap(ctx, text, maxW);
    const widest = Math.max(0, ...lines.map(l => ctx.measureText(l).width));
    if ((lines.length <= MAX_LINES && widest <= maxW) || px < start * 0.3) return { px, lines };
    px *= 0.92;
  }
}

export function initRemix(win: HTMLElement) {
  const root = win.querySelector<HTMLElement>("[data-remix]");
  if (!root) return;
  const canvas = root.querySelector<HTMLCanvasElement>("[data-remix-canvas]")!;
  const ctx = canvas.getContext("2d")!;
  const stage = root.querySelector<HTMLElement>("[data-remix-stage]")!;
  const note = root.querySelector<HTMLElement>("[data-remix-note]")!;
  const topIn = root.querySelector<HTMLInputElement>("[data-remix-top]")!;
  const bottomIn = root.querySelector<HTMLInputElement>("[data-remix-bottom]")!;
  const sizeIn = root.querySelector<HTMLInputElement>("[data-remix-size]")!;
  const stSize = root.querySelector<HTMLInputElement>("[data-remix-sticker-size]")!;
  const stRot = root.querySelector<HTMLInputElement>("[data-remix-sticker-rotate]")!;
  const stRemove = root.querySelector<HTMLButtonElement>("[data-remix-sticker-remove]")!;
  const subtitle = win.querySelector<HTMLElement>("[data-remix-subtitle]");

  const piece = { id: root.dataset.id!, title: root.dataset.title!, client: root.dataset.client! };
  let img: HTMLImageElement | null = null;
  let selected = -1;
  let loadToken = 0;
  let noteTimer = 0;

  const say = (text: string, ms = 4200) => {
    note.textContent = text;
    note.classList.toggle("is-visible", !!text);
    clearTimeout(noteTimer);
    if (text && ms) noteTimer = window.setTimeout(() => note.classList.remove("is-visible"), ms);
  };

  const geometry = () => {
    const W = img!.naturalWidth;
    const H = img!.naturalHeight;
    const pad = W * 0.045;
    let barTop = 0;
    let barBottom = 0;
    let topFit: ReturnType<typeof fit> | null = null;
    let bottomFit: ReturnType<typeof fit> | null = null;
    const base = W * 0.1 * shared.size;
    if (shared.style === "bar") {
      const font = (px: number) => `600 ${px}px ${BAR_FONT}`;
      const start = base * 0.62;
      if (shared.top.trim()) {
        topFit = fit(ctx, shared.top.trim(), W - pad * 2, start, font);
        barTop = topFit.lines.length * topFit.px * 1.22 + pad * 1.3;
      }
      if (shared.bottom.trim()) {
        bottomFit = fit(ctx, shared.bottom.trim(), W - pad * 2, start, font);
        barBottom = bottomFit.lines.length * bottomFit.px * 1.22 + pad * 1.3;
      }
    } else {
      if (shared.top.trim()) topFit = fit(ctx, shared.top.trim().toUpperCase(), W - pad * 2, base, memeFont);
      if (shared.bottom.trim()) bottomFit = fit(ctx, shared.bottom.trim().toUpperCase(), W - pad * 2, base, memeFont);
    }
    return { W, H, pad, barTop, barBottom, topFit, bottomFit, total: H + barTop + barBottom };
  };

  const draw = (exporting = false) => {
    if (!img) return;
    const g = geometry();
    if (canvas.width !== g.W || canvas.height !== Math.round(g.total)) {
      canvas.width = g.W;
      canvas.height = Math.round(g.total);
    }
    const { W, H, pad, barTop } = g;
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, barTop, W, H);
    ctx.textAlign = "center";

    if (shared.style === "bar") {
      ctx.fillStyle = "#111";
      ctx.textBaseline = "top";
      if (g.topFit) {
        ctx.font = `600 ${g.topFit.px}px ${BAR_FONT}`;
        g.topFit.lines.forEach((l, i) => ctx.fillText(l, W / 2, pad * 0.65 + i * g.topFit!.px * 1.22));
      }
      if (g.bottomFit) {
        ctx.font = `600 ${g.bottomFit.px}px ${BAR_FONT}`;
        g.bottomFit.lines.forEach((l, i) => ctx.fillText(l, W / 2, barTop + H + pad * 0.65 + i * g.bottomFit!.px * 1.22));
      }
    } else {
      ctx.lineJoin = "round";
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = "#000";
      const classic = (f: NonNullable<typeof g.topFit>, y0: number, fromBottom: boolean) => {
        ctx.font = memeFont(f.px);
        ctx.lineWidth = f.px * 0.14;
        ctx.textBaseline = fromBottom ? "bottom" : "top";
        const lh = f.px * 1.05;
        f.lines.forEach((l, i) => {
          const y = fromBottom ? y0 - (f.lines.length - 1 - i) * lh : y0 + i * lh;
          ctx.strokeText(l, W / 2, y);
          ctx.fillText(l, W / 2, y);
        });
      };
      if (g.topFit) classic(g.topFit, pad * 0.6, false);
      if (g.bottomFit) classic(g.bottomFit, H - pad * 0.6, true);
    }

    shared.stickers.forEach((s, i) => {
      const px = s.s * W;
      ctx.save();
      ctx.translate(s.x * W, barTop + s.y * H);
      ctx.rotate((s.r * Math.PI) / 180);
      ctx.font = `${px}px ${EMOJI}`;
      ctx.textBaseline = "middle";
      ctx.fillText(s.ch, 0, px * 0.06);
      if (!exporting && i === selected) {
        ctx.setLineDash([px * 0.08, px * 0.06]);
        ctx.lineWidth = Math.max(2, W * 0.003);
        ctx.strokeStyle = "#0a84ff";
        ctx.strokeRect(-px * 0.62, -px * 0.62, px * 1.24, px * 1.24);
      }
      ctx.restore();
    });

    const mark = Math.max(12, W * 0.024);
    ctx.font = `600 ${mark}px ${BAR_FONT}`;
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    ctx.shadowColor = "rgba(0,0,0,.55)";
    ctx.shadowBlur = mark * 0.4;
    ctx.fillStyle = "rgba(255,255,255,.88)";
    ctx.fillText("@Pizelxx", W - W * 0.018, barTop + H - W * 0.014);
    ctx.restore();
  };

  const syncSelection = () => {
    const s = shared.stickers[selected];
    [stSize, stRot, stRemove].forEach(el => (el.disabled = !s));
    if (s) {
      stSize.value = String(Math.round(s.s * 100));
      stRot.value = String(Math.round(s.r));
    }
  };

  const select = (i: number) => {
    selected = i;
    syncSelection();
    draw();
  };

  const syncInputs = () => {
    topIn.value = shared.top;
    bottomIn.value = shared.bottom;
    sizeIn.value = String(Math.round(shared.size * 100));
    root.querySelectorAll<HTMLElement>("[data-remix-style]").forEach(b => b.setAttribute("aria-checked", String(b.dataset.remixStyle === shared.style)));
    syncSelection();
  };

  const load = (src: string) => {
    const token = ++loadToken;
    stage.classList.add("is-loading");
    const next = new Image();
    next.decoding = "async";
    next.src = src;
    next.decode().then(
      () => {
        if (token !== loadToken || !win.isConnected) return;
        img = next;
        stage.classList.remove("is-loading");
        draw();
      },
      () => {
        if (token !== loadToken) return;
        stage.classList.remove("is-loading");
        say("Couldn't load this piece. Try another one.", 0);
      },
    );
  };

  const choose = (a: HTMLAnchorElement) => {
    piece.id = a.dataset.remixPick!;
    piece.title = a.dataset.title!;
    piece.client = a.dataset.client!;
    root.dataset.id = piece.id;
    win.querySelectorAll(".remix-pick.is-current").forEach(n => n.classList.remove("is-current"));
    a.classList.add("is-current");
    if (subtitle) subtitle.textContent = `${piece.title} · ${piece.client}`;
    stage.style.setProperty("--ph", a.style.getPropertyValue("--ph"));
    canvas.setAttribute("aria-label", `Remix of ${piece.title}`);
    const url = `/remix/${piece.id}`;
    win.dataset.url = url;
    if (win.classList.contains("is-focused")) history.replaceState({ url }, "", url);
    load(a.dataset.src!);
  };

  const toCanvas = (e: { clientX: number; clientY: number }) => {
    const r = canvas.getBoundingClientRect();
    const g = img ? geometry() : null;
    if (!g) return null;
    const x = ((e.clientX - r.left) / r.width) * canvas.width;
    const y = ((e.clientY - r.top) / r.height) * canvas.height;
    return { nx: x / g.W, ny: (y - g.barTop) / g.H, x, y, g };
  };

  const hit = (p: NonNullable<ReturnType<typeof toCanvas>>) => {
    for (let i = shared.stickers.length - 1; i >= 0; i--) {
      const s = shared.stickers[i];
      const half = s.s * p.g.W * 0.6;
      if (Math.abs(p.x - s.x * p.g.W) < half && Math.abs(p.y - (p.g.barTop + s.y * p.g.H)) < half) return i;
    }
    return -1;
  };

  canvas.addEventListener("pointerdown", e => {
    if (e.button !== 0) return;
    const p = toCanvas(e);
    if (!p) return;
    const i = hit(p);
    select(i);
    if (i < 0) return;
    e.preventDefault();
    const s = shared.stickers[i];
    shared.stickers.push(...shared.stickers.splice(i, 1));
    selected = shared.stickers.length - 1;
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add("is-dragging");
    const ox = p.nx - s.x;
    const oy = p.ny - s.y;
    let frame = 0;
    const move = (ev: PointerEvent) => {
      const q = toCanvas(ev);
      if (!q) return;
      s.x = Math.max(0, Math.min(1, q.nx - ox));
      s.y = Math.max(0, Math.min(1, q.ny - oy));
      if (!frame) frame = requestAnimationFrame(() => {
        frame = 0;
        draw();
      });
    };
    const up = () => {
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
      canvas.classList.remove("is-dragging");
    };
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
  });

  canvas.addEventListener("pointermove", e => {
    if (canvas.classList.contains("is-dragging")) return;
    const p = toCanvas(e);
    canvas.classList.toggle("is-over-sticker", !!p && hit(p) >= 0);
  });

  canvas.addEventListener("wheel", e => {
    const p = toCanvas(e);
    if (!p) return;
    const i = hit(p);
    const target = i >= 0 ? i : selected;
    if (target < 0) return;
    e.preventDefault();
    const s = shared.stickers[target];
    if (e.shiftKey) s.r = ((s.r + e.deltaY * 0.2 + 540) % 360) - 180;
    else s.s = Math.max(0.04, Math.min(0.45, s.s * Math.exp(-e.deltaY * 0.0015)));
    if (target !== selected) selected = target;
    syncSelection();
    draw();
  }, { passive: false });

  const exportBlob = () =>
    new Promise<Blob>((resolve, reject) => {
      draw(true);
      canvas.toBlob(b => {
        draw();
        b ? resolve(b) : reject(new Error("export failed"));
      }, "image/png");
    });

  const fileName = () => `pizelxx-remix-${piece.id.split("/").pop()}.png`;

  const download = (blob: Blob) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = fileName();
    a.dataset.reload = "";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };

  const copy = async () => {
    if (!img) return false;
    if (!("ClipboardItem" in window) || !navigator.clipboard?.write) return false;
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": exportBlob() })]);
      return true;
    } catch {
      return false;
    }
  };

  win.querySelector("[data-remix-download]")?.addEventListener("click", async () => {
    if (!img) return;
    download(await exportBlob());
    say(`Saved ${fileName()}`);
  });

  win.querySelector("[data-remix-copy]")?.addEventListener("click", async () => {
    say((await copy()) ? "Copied. Paste it anywhere." : "This browser can't copy images. Use Save PNG instead.");
  });

  win.querySelector("[data-remix-post]")?.addEventListener("click", async () => {
    if (!img) return;
    const copied = await copy();
    if (!copied) download(await exportBlob());
    const text = `Remixed "${piece.title}" by @Pizelxx`;
    const link = `${location.origin}/work/${piece.id}`;
    const intent = `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(link)}`;
    const tab = window.open(intent, "_blank", "noopener");
    const how = copied ? "Image copied, so paste it into your post" : `Image saved as ${fileName()}, so attach it to your post`;
    say(tab === null ? `${how}. Your browser blocked the X tab. Allow pop-ups and press Post again.` : `${how}.`, 7000);
  });

  win.querySelector("[data-remix-shuffle]")?.addEventListener("click", () => {
    const pool = captions.filter(([t, b]) => t !== shared.top || b !== shared.bottom);
    [shared.top, shared.bottom] = pool[Math.floor(Math.random() * pool.length)];
    syncInputs();
    draw();
  });

  root.addEventListener("click", e => {
    const t = e.target as HTMLElement;
    const style = t.closest<HTMLElement>("[data-remix-style]");
    if (style) {
      shared.style = style.dataset.remixStyle as Style;
      syncInputs();
      draw();
      return;
    }
    const add = t.closest<HTMLElement>("[data-remix-sticker]");
    if (add) {
      const n = shared.stickers.length;
      shared.stickers.push({ ch: add.dataset.remixSticker!, x: 0.5 + ((n % 5) - 2) * 0.08, y: 0.5 + ((Math.floor(n / 5) % 3) - 1) * 0.1, s: 0.16, r: 0 });
      select(shared.stickers.length - 1);
      return;
    }
    if (t.closest("[data-remix-sticker-remove]")) {
      removeSelected();
      return;
    }
    if (t.closest("[data-remix-reset]")) {
      Object.assign(shared, { top: "", bottom: "", style: "classic", size: 1, stickers: [] });
      selected = -1;
      syncInputs();
      draw();
    }
  });

  const removeSelected = () => {
    if (selected < 0) return;
    shared.stickers.splice(selected, 1);
    select(-1);
  };

  topIn.addEventListener("input", () => {
    shared.top = topIn.value;
    draw();
  });
  bottomIn.addEventListener("input", () => {
    shared.bottom = bottomIn.value;
    draw();
  });
  sizeIn.addEventListener("input", () => {
    shared.size = Number(sizeIn.value) / 100;
    draw();
  });
  stSize.addEventListener("input", () => {
    const s = shared.stickers[selected];
    if (!s) return;
    s.s = Number(stSize.value) / 100;
    draw();
  });
  stRot.addEventListener("input", () => {
    const s = shared.stickers[selected];
    if (!s) return;
    s.r = Number(stRot.value);
    draw();
  });

  win.addEventListener("click", e => {
    const a = (e.target as HTMLElement).closest<HTMLAnchorElement>("[data-remix-pick]");
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    choose(a);
  });

  const onKey = (e: KeyboardEvent) => {
    if (!root.isConnected) {
      document.removeEventListener("keydown", onKey);
      return;
    }
    if (!win.classList.contains("is-focused") || (e.target as HTMLElement).closest("input, textarea, select")) return;
    if ((e.key === "Delete" || e.key === "Backspace") && selected >= 0) {
      e.preventDefault();
      removeSelected();
    }
    if (e.key === "Escape") select(-1);
  };
  document.addEventListener("keydown", onKey);

  syncInputs();
  load(root.dataset.src!);
  document.fonts?.load(`900 40px "Inter Variable"`).then(() => draw(), () => {});
}
