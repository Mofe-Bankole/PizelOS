import { num, px } from "../../tokens/read";
import { reducedMotion, springEasing } from "../Motion/spring";

interface Rect { x: number; y: number; w: number; h: number }
interface Win extends Rect {
  el: HTMLElement;
  id: string;
  app: string;
  minW: number;
  minH: number;
  minimized: boolean;
  restore?: Rect;
}

const wins = new Map<string, Win>();
const pageCache = new Map<string, Promise<Document>>();
let desktop: HTMLElement;
let z = 100;
let focused: Win | null = null;

const narrow = () => innerWidth < 768;

function area() {
  const h = desktop.clientHeight - px("--dock-h") - px("--dock-bottom") - 8;
  return { w: desktop.clientWidth, h: Math.max(200, h) };
}

function snap(v: number) {
  const dpr = devicePixelRatio || 1;
  return Math.round(v * dpr) / dpr;
}

function apply(win: Win) {
  win.el.style.transform = `translate3d(${snap(win.x)}px,${snap(win.y)}px,0)`;
  win.el.style.width = `${Math.round(win.w)}px`;
  win.el.style.height = `${Math.round(win.h)}px`;
}

function clampRect(win: Win) {
  const a = area();
  win.w = Math.max(win.minW, Math.min(win.w, a.w - 16));
  win.h = Math.max(win.minH, Math.min(win.h, a.h - 8));
  win.x = Math.min(Math.max(win.x, -win.w + 120), a.w - 120);
  win.y = Math.min(Math.max(win.y, 0), a.h - 40);
}

function register(el: HTMLElement): Win {
  const a = area();
  const w = Math.min(Number(el.dataset.w), a.w - 80);
  const h = Math.min(Number(el.dataset.h), a.h - 40);
  const offset = (wins.size % 6) * px("--window-cascade");
  const win: Win = {
    el,
    id: el.dataset.window!,
    app: el.dataset.app!,
    minW: Number(el.dataset.minW),
    minH: Number(el.dataset.minH),
    w,
    h,
    x: (a.w - w) / 2 + offset,
    y: Math.max(12, (a.h - h) / 2 - 10) + offset,
    minimized: false,
  };
  clampRect(win);
  el.classList.add("is-managed");
  apply(win);
  addResizeHandles(el);
  wins.set(win.id, win);
  mounted(el);
  return win;
}

function mounted(el: HTMLElement) {
  document.dispatchEvent(new CustomEvent("window:mounted", { detail: el }));
}

function focus(win: Win | null, updateUrl = true) {
  focused = win;
  wins.forEach(w => w.el.classList.toggle("is-focused", w === win));
  if (win) {
    win.el.style.zIndex = String(++z);
    if (updateUrl && win.el.dataset.url && location.pathname !== win.el.dataset.url) history.replaceState({ url: win.el.dataset.url }, "", win.el.dataset.url);
  }
  document.dispatchEvent(new CustomEvent("shell:focus", { detail: win ? { app: win.app, id: win.id, title: win.el.dataset.title } : null }));
  document.addEventListener("shell:booted", e => {
    if ((e as CustomEvent).detail?.saveData) return;
    const idle = (fn: () => void) => ("requestIdleCallback" in window ? requestIdleCallback(fn, { timeout: 2000 }) : setTimeout(fn, 300));
    idle(() => {
      loadPage("/work")
        .then(doc => {
          doc.querySelectorAll<SVGImageElement>(".folder-icon image").forEach(img => {
            const href = img.getAttribute("href");
            if (href) new Image().src = href;
          });
        })
        .catch(() => {});
    });
  });

  syncDock();
}

function topmost(): Win | null {
  let best: Win | null = null;
  wins.forEach(w => {
    if (!w.minimized && (!best || Number(w.el.style.zIndex) > Number(best.el.style.zIndex))) best = w;
  });
  return best;
}

function syncDock() {
  const running = new Set([...wins.values()].map(w => w.app));
  document.querySelectorAll<HTMLElement>(".dock-item[data-app]").forEach(item => {
    item.classList.toggle("is-running", running.has(item.dataset.app!));
  });
}

function dockRect(app: string): DOMRect | null {
  return document.querySelector(`.dock-item[data-app="${app}"] .dock-scale`)?.getBoundingClientRect() ?? null;
}

function toDesktop(r: DOMRect) {
  const d = desktop.getBoundingClientRect();
  return { x: r.left - d.left, y: r.top - d.top, w: r.width, h: r.height };
}

function zoomFrom(win: Win, from: DOMRect | null, reverse = false): Promise<void> {
  if (reducedMotion() || narrow()) {
    if (reverse) return Promise.resolve();
    return win.el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160 }).finished.then(() => {});
  }
  const end = `translate3d(${snap(win.x)}px,${snap(win.y)}px,0) scale(1)`;
  let start: string;
  if (from) {
    const f = toDesktop(from);
    const s = f.w / win.w;
    start = `translate3d(${f.x + f.w / 2 - (win.w * s) / 2}px,${f.y + f.h / 2 - (win.h * s) / 2}px,0) scale(${s})`;
  } else {
    const s = 0.94;
    start = `translate3d(${win.x + (win.w * (1 - s)) / 2}px,${win.y + (win.h * (1 - s)) / 2}px,0) scale(${s})`;
  }
  const spring = springEasing({ stiffness: num("--spring-window-stiffness"), damping: num("--spring-window-damping") });
  const frames = reverse
    ? [{ transform: end, opacity: 1 }, { transform: start, opacity: 0 }]
    : [{ transform: start, opacity: 0, offset: 0 }, { opacity: 1, offset: 0.25 }, { transform: end, opacity: 1, offset: 1 }];
  const anim = win.el.animate(frames, {
    duration: reverse ? 260 : Math.min(spring.duration, 620),
    easing: reverse ? "cubic-bezier(.4,0,.8,.6)" : spring.easing,
  });
  return anim.finished.then(() => {});
}

function loadPage(url: string): Promise<Document> {
  let p = pageCache.get(url);
  if (!p) {
    p = fetch(url, { headers: { accept: "text/html" } })
      .then(r => {
        if (!r.ok) throw new Error(String(r.status));
        return r.text();
      })
      .then(html => new DOMParser().parseFromString(html, "text/html"));
    pageCache.set(url, p);
    p.catch(() => pageCache.delete(url));
  }
  return p;
}

export async function open(url: string, opts: { from?: DOMRect | null; push?: boolean } = {}) {
  const path = new URL(url, location.href).pathname;
  if (path === "/") return;
  let doc: Document;
  try {
    doc = await loadPage(path);
  } catch {
    location.href = path;
    return;
  }
  const incoming = doc.querySelector<HTMLElement>("#desktop > .window");
  if (!incoming) return;
  const id = incoming.dataset.window!;
  const existing = wins.get(id);
  const push = opts.push ?? true;

  if (existing) {
    if (existing.el.dataset.url !== path) {
      existing.el.replaceChildren(...[...incoming.childNodes].map(n => document.importNode(n, true)));
      for (const attr of ["data-url", "data-title", "aria-label", "class"]) {
        const v = incoming.getAttribute(attr);
        if (v !== null) existing.el.setAttribute(attr, v);
      }
      existing.el.classList.add("is-managed");
      addResizeHandles(existing.el);
      mounted(existing.el);
    }
    if (existing.minimized) await restore(existing);
    focus(existing, false);
  } else {
    const el = document.importNode(incoming, true) as HTMLElement;
    el.style.opacity = "0";
    desktop.appendChild(el);
    const win = register(el);
    focus(win, false);
    el.style.opacity = "";
    await zoomFrom(win, opts.from ?? dockRect(win.app));
  }
  document.title = doc.title;
  if (push && location.pathname !== path) history.pushState({ url: path }, "", path);
  else if (location.pathname !== path) history.replaceState({ url: path }, "", path);
}

export async function close(win: Win, updateUrl = true) {
  wins.delete(win.id);
  syncDock();
  if (!reducedMotion()) {
    const t = `translate3d(${snap(win.x)}px,${snap(win.y)}px,0)`;
    const s = 0.95;
    const t2 = `translate3d(${win.x + (win.w * (1 - s)) / 2}px,${win.y + (win.h * (1 - s)) / 2}px,0) scale(${s})`;
    await win.el.animate([{ transform: t, opacity: 1 }, { transform: t2, opacity: 0 }], { duration: 170, easing: "ease-out" }).finished;
  }
  win.el.remove();
  const next = topmost();
  focus(next, false);
  if (updateUrl) {
    const url = next?.el.dataset.url ?? "/";
    history.pushState({ url }, "", url);
    document.title = next?.el.dataset.title ? `${next.el.dataset.title} — Pizelxx` : "Pizelxx";
  }
}

async function minimize(win: Win) {
  if (narrow()) return close(win);
  win.minimized = true;
  await zoomFrom(win, dockRect(win.app), true);
  win.el.hidden = true;
  const next = topmost();
  focus(next, false);
  const url = next?.el.dataset.url ?? "/";
  history.replaceState({ url }, "", url);
}

async function restore(win: Win) {
  win.minimized = false;
  win.el.hidden = false;
  await zoomFrom(win, dockRect(win.app));
}

function zoom(win: Win) {
  if (narrow()) return;
  const before = { x: win.x, y: win.y, w: win.w, h: win.h };
  if (win.restore) {
    Object.assign(win, win.restore);
    win.restore = undefined;
  } else {
    const a = area();
    win.restore = before;
    Object.assign(win, { x: 8, y: 8, w: a.w - 16, h: a.h - 8 });
  }
  apply(win);
  if (reducedMotion()) return;
  const sx = before.w / win.w;
  const sy = before.h / win.h;
  win.el.animate(
    [
      { transform: `translate3d(${before.x}px,${before.y}px,0) scale(${sx},${sy})` },
      { transform: `translate3d(${snap(win.x)}px,${snap(win.y)}px,0) scale(1,1)` },
    ],
    { duration: 300, easing: springEasing({ stiffness: 320, damping: 34 }).easing },
  );
}

function addResizeHandles(el: HTMLElement) {
  if (el.querySelector(".window-resize")) return;
  for (const edge of ["e", "s", "w", "se", "sw"]) {
    const h = document.createElement("div");
    h.className = "window-resize";
    h.dataset.edge = edge;
    el.appendChild(h);
  }
}

function startDrag(win: Win, e: PointerEvent) {
  const sx = e.clientX - win.x;
  const sy = e.clientY - win.y;
  const target = e.target as HTMLElement;
  target.setPointerCapture(e.pointerId);
  let raf = 0;
  const move = (ev: PointerEvent) => {
    win.x = ev.clientX - sx;
    win.y = Math.max(0, ev.clientY - sy);
    if (!raf) raf = requestAnimationFrame(() => {
      raf = 0;
      apply(win);
    });
  };
  const up = () => {
    target.removeEventListener("pointermove", move);
    target.removeEventListener("pointerup", up);
    target.removeEventListener("pointercancel", up);
    clampRect(win);
    apply(win);
  };
  target.addEventListener("pointermove", move);
  target.addEventListener("pointerup", up);
  target.addEventListener("pointercancel", up);
}

function startResize(win: Win, edge: string, e: PointerEvent) {
  const start = { ...win, px: e.clientX, py: e.clientY };
  const target = e.target as HTMLElement;
  target.setPointerCapture(e.pointerId);
  win.restore = undefined;
  let raf = 0;
  const move = (ev: PointerEvent) => {
    const dx = ev.clientX - start.px;
    const dy = ev.clientY - start.py;
    if (edge.includes("e")) win.w = Math.max(win.minW, start.w + dx);
    if (edge.includes("s")) win.h = Math.max(win.minH, start.h + dy);
    if (edge.includes("w")) {
      const w = Math.max(win.minW, start.w - dx);
      win.x = start.x + (start.w - w);
      win.w = w;
    }
    if (!raf) raf = requestAnimationFrame(() => {
      raf = 0;
      apply(win);
    });
  };
  const up = () => {
    target.removeEventListener("pointermove", move);
    target.removeEventListener("pointerup", up);
    target.removeEventListener("pointercancel", up);
  };
  target.addEventListener("pointermove", move);
  target.addEventListener("pointerup", up);
  target.addEventListener("pointercancel", up);
}

const INTERACTIVE = "button, a, input, select, textarea, label, [data-no-drag], [contenteditable]";

function routable(a: HTMLAnchorElement) {
  if (a.target && a.target !== "_self") return false;
  if (a.hasAttribute("download") || a.dataset.reload !== undefined) return false;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin) return false;
  return !url.pathname.startsWith("/test") && !/\.[a-z0-9]+$/i.test(url.pathname);
}

export function initWindowManager(root: HTMLElement) {
  desktop = root;
  const initial = [...desktop.querySelectorAll<HTMLElement>(":scope > .window")];
  initial.forEach(el => register(el));
  focus(initial.length ? wins.get(initial[initial.length - 1].dataset.window!)! : null, false);
  history.replaceState({ url: location.pathname }, "", location.href);

  desktop.addEventListener("pointerdown", e => {
    const el = (e.target as HTMLElement).closest<HTMLElement>(".window");
    if (!el) return;
    const win = wins.get(el.dataset.window!);
    if (!win) return;
    if (win !== focused) focus(win);
    if (e.button !== 0 || narrow()) return;
    const handle = (e.target as HTMLElement).closest<HTMLElement>(".window-resize");
    if (handle) {
      e.preventDefault();
      startResize(win, handle.dataset.edge!, e);
      return;
    }
    const region = (e.target as HTMLElement).closest("[data-drag-region]");
    if (region && !(e.target as HTMLElement).closest(INTERACTIVE)) {
      e.preventDefault();
      startDrag(win, e);
    }
  });

  desktop.addEventListener("dblclick", e => {
    const region = (e.target as HTMLElement).closest("[data-drag-region]");
    const el = (e.target as HTMLElement).closest<HTMLElement>(".window");
    if (region && el && !(e.target as HTMLElement).closest(INTERACTIVE)) zoom(wins.get(el.dataset.window!)!);
  });

  desktop.addEventListener("click", e => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>("[data-window-action]");
    if (!btn) return;
    const win = wins.get(btn.closest<HTMLElement>(".window")!.dataset.window!);
    if (!win) return;
    const action = btn.dataset.windowAction;
    if (action === "close") close(win);
    if (action === "minimize") minimize(win);
    if (action === "zoom") zoom(win);
  });

  document.addEventListener("click", e => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as HTMLElement).closest<HTMLAnchorElement>("a[href]");
    if (!a || !routable(a)) return;
    e.preventDefault();
    const from = a.closest(".window") ? null : a.getBoundingClientRect();
    open(a.href, { from: a.closest(".dock") ? null : from });
  });

  document.addEventListener("shell:open", (e: Event) => {
    const { href } = (e as CustomEvent).detail as { href: string };
    if (!href) return;
    const app = (e as CustomEvent).detail.app as string;
    const existing = [...wins.values()].find(w => w.app === app);
    if (existing && (existing.minimized || existing !== focused)) {
      (existing.minimized ? restore(existing) : Promise.resolve()).then(() => {
        focus(existing);
      });
      return;
    }
    if (!existing) open(href);
  });

  document.addEventListener("shell:action", (e: Event) => {
    const action = (e as CustomEvent).detail;
    if (action === "close-window" && focused) close(focused);
    if (action === "minimize-window" && focused) minimize(focused);
    if (action === "zoom-window" && focused) zoom(focused);
    if (action === "close-all") {
      [...wins.values()].forEach(w => close(w, false));
      history.pushState({ url: "/" }, "", "/");
      document.title = "Pizelxx";
    }
  });

  addEventListener("popstate", () => {
    const path = location.pathname;
    if (path === "/") {
      [...wins.values()].forEach(w => close(w, false));
      document.title = "Pizelxx";
      return;
    }
    const match = [...wins.values()].find(w => w.el.dataset.url === path);
    if (match) {
      if (match.minimized) restore(match);
      focus(match, false);
    } else {
      open(path, { push: false });
    }
  });

  addEventListener("resize", () => {
    wins.forEach(w => {
      clampRect(w);
      apply(w);
    });
  });

  addEventListener("pointerover", e => {
    const a = (e.target as Element).closest?.("a[href]") as HTMLAnchorElement | null;
    if (a && routable(a)) loadPage(new URL(a.href).pathname).catch(() => {});
  }, { passive: true });

  document.addEventListener("shell:booted", e => {
    if ((e as CustomEvent).detail?.saveData) return;
    const idle = (fn: () => void) => ("requestIdleCallback" in window ? requestIdleCallback(fn, { timeout: 2000 }) : setTimeout(fn, 300));
    idle(() => {
      loadPage("/work")
        .then(doc => {
          doc.querySelectorAll<SVGImageElement>(".folder-icon image").forEach(img => {
            const href = img.getAttribute("href");
            if (href) new Image().src = href;
          });
        })
        .catch(() => {});
    });
  });

  syncDock();
}
