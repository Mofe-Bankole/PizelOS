import { initArtwork, whenAllReady } from "../scripts/media-loader";
import { open } from "../shell/Window/window-manager";
import { Spring, reducedMotion } from "../shell/Motion/spring";
import { initRemix } from "./remix/remix";
import { initTerminal } from "./terminal/terminal";
import { initHire } from "./hire/hire";

const focusedWindow = (id: string) => document.querySelector<HTMLElement>(`.window.is-focused[data-window="${id}"]`);

document.addEventListener("click", e => {
  const t = e.target as HTMLElement;

  const hist = t.closest<HTMLElement>("[data-history]");
  if (hist) {
    hist.dataset.history === "back" ? history.back() : history.forward();
    return;
  }

  const finderLink = t.closest<HTMLAnchorElement>(".finder-link");
  if (finderLink && (e as PointerEvent).pointerType !== "touch" && e.detail < 2) {
    e.preventDefault();
    finderLink.closest(".finder-grid")?.querySelectorAll(".is-selected").forEach(n => n.classList.remove("is-selected"));
    finderLink.classList.add("is-selected");
    finderLink.focus({ preventScroll: true });
    return;
  }
  if (finderLink && e.detail >= 2) {
    e.preventDefault();
    return;
  }

  const inspector = t.closest<HTMLElement>("[data-toggle-inspector]");
  if (inspector) {
    const preview = inspector.closest(".window")?.querySelector(".preview");
    const hidden = preview?.classList.toggle("inspector-hidden");
    inspector.setAttribute("aria-pressed", String(!hidden));
    return;
  }

  const filter = t.closest<HTMLElement>("[data-filter]");
  if (filter) {
    const win = filter.closest(".window")!;
    win.querySelectorAll("[data-filter]").forEach(b => b.setAttribute("aria-pressed", String(b === filter)));
    const value = filter.dataset.filter;
    let count = 0;
    win.querySelectorAll<HTMLElement>(".gallery-item").forEach(item => {
      const show = !value || item.dataset.project === value;
      item.hidden = !show;
      if (show) count++;
    });
    const label = win.querySelector("[data-gallery-count]");
    if (label) label.textContent = `${count} pieces`;
    return;
  }

  const note = t.closest<HTMLElement>("[data-note]");
  if (note) {
    const win = note.closest(".window")!;
    win.querySelectorAll("[data-note]").forEach(n => n.classList.toggle("is-current", n === note));
    win.querySelectorAll<HTMLElement>("[data-note-body]").forEach(b => (b.hidden = b.dataset.noteBody !== note.dataset.note));
    return;
  }

}, true);

document.addEventListener("dblclick", e => {
  const link = (e.target as HTMLElement).closest<HTMLAnchorElement>(".finder-link");
  if (link) open(link.href);
});

document.addEventListener("keydown", e => {
  const t = e.target as HTMLElement;
  if (t.closest("input, textarea, select, [contenteditable]")) return;
  if (e.key === "Enter" && t.classList.contains("finder-link")) {
    e.preventDefault();
    open((t as HTMLAnchorElement).href);
    return;
  }
  const preview = focusedWindow("preview");
  if (preview && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
    preview.querySelector<HTMLAnchorElement>(`[data-key="${e.key}"]`)?.click();
  }
});

document.addEventListener("input", e => {
  const input = e.target as HTMLInputElement;
  if (input.matches("[data-finder-search]")) {
    const q = input.value.trim().toLowerCase();
    input.closest(".window")?.querySelectorAll<HTMLElement>(".finder-item").forEach(item => {
      item.hidden = !!q && !item.dataset.name!.includes(q);
    });
  }
});

document.addEventListener("submit", e => {
  const form = e.target as HTMLFormElement;
  if (!form.matches("[data-compose]")) return;
  e.preventDefault();
  const data = new FormData(form);
  const subject = String(data.get("subject"));
  const body = `${data.get("body")}\n\n— ${data.get("from")}`;
  const note = form.querySelector("[data-compose-note]")!;
  if (form.dataset.email) {
    location.href = `mailto:${form.dataset.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    return;
  }
  const text = `${subject}\n\n${body}`;
  navigator.clipboard?.writeText(text).then(
    () => (note.textContent = "Message copied. Paste it into your DM on X."),
    () => (note.textContent = "Couldn't copy automatically. Select your message and copy it, then DM on X."),
  );
  window.open(form.dataset.x, "_blank", "noopener");
});

function initLayers(win: HTMLElement) {
  const root = win.querySelector<HTMLElement>("[data-layers]");
  if (!root) return;
  const stage = root.querySelector<HTMLElement>("[data-layers-stage]")!;
  const stack = root.querySelector<HTMLElement>("[data-layers-stack]")!;
  const planes = [...stack.querySelectorAll<HTMLElement>(".layers-plane")];
  const imgs = planes.map(p => p.querySelector<HTMLImageElement>("img")!);
  const flat = stack.querySelector<HTMLElement>("[data-layers-flat]")!;
  const rows = [...root.querySelectorAll<HTMLElement>("[data-layer-row]")];
  const eyes = [...root.querySelectorAll<HTMLButtonElement>("[data-layer-eye]")];
  const hint = root.querySelector<HTMLElement>("[data-layers-hint]");
  const nameEl = root.querySelector<HTMLElement>("[data-layers-selected-name]")!;
  const opacity = root.querySelector<HTMLInputElement>("[data-layers-opacity]")!;
  const opacityOut = root.querySelector<HTMLOutputElement>("[data-layers-opacity-value]")!;
  const resetLayerBtn = root.querySelector<HTMLButtonElement>("[data-layers-reset-layer]")!;
  const slider = win.querySelector<HTMLInputElement>("[data-layers-amount]");
  const play = win.querySelector<HTMLElement>("[data-layers-play]");
  const names = rows.reduce<string[]>((acc, r) => {
    acc[Number(r.dataset.layerRow)] = r.querySelector(".layers-name")?.textContent ?? "";
    return acc;
  }, []);

  const spring = new Spring(0, { stiffness: 70, damping: 16 });
  const view = { rx: 0, rz: 0, zoom: 1, px: 0, py: 0 };
  const offsets = planes.map(() => ({ x: 0, y: 0 }));
  const baseOpacity = imgs.map(img => Number(img.dataset.opacity ?? 1));
  const layerOpacity = imgs.map(() => 1);
  const visible = planes.map(() => true);
  let selected = -1;
  let amount = 0;
  let raf = 0;
  let last = 0;
  let spaceHeld = false;

  const edited = () =>
    offsets.some(o => o.x !== 0 || o.y !== 0) || visible.some(v => !v) || layerOpacity.some(o => o !== 1);

  const render = (a: number) => {
    amount = a;
    const H = stack.offsetHeight;
    const total = H * Math.min(0.16 * (planes.length - 1), 0.85);
    const gap = total / Math.max(1, planes.length - 1);
    const t = Math.max(0, Math.min(1, a));
    stack.style.transform =
      `translate(${view.px}px, ${view.py + t * total * 0.32}px) ` +
      `rotateX(${56 * t + view.rx}deg) rotateZ(${-32 * t + view.rz}deg) scale(${(1 - 0.36 * t) * view.zoom})`;
    flat.style.opacity = edited() ? "0" : String(Math.max(0, 1 - t * 6));
    const frame = Math.max(0, Math.min(1, (t - 0.15) * 3));
    planes.forEach((p, i) => {
      const lift = Math.max(0, Math.min(1, t * planes.length - i * 0.6));
      const o = offsets[i];
      p.style.transform = `translate3d(${o.x}px, ${o.y}px, ${i * gap * (0.25 * t + 0.75 * lift)}px)`;
      p.style.setProperty("--frame", String(frame));
      p.classList.toggle("is-selected", i === selected);
      p.classList.toggle("is-off", !visible[i]);
      imgs[i].style.opacity = String(baseOpacity[i] * layerOpacity[i]);
    });
    const active = Math.min(planes.length - 1, Math.floor(t * planes.length));
    rows.forEach(r => {
      const i = Number(r.dataset.layerRow);
      r.classList.toggle("is-active", selected < 0 && t > 0.05 && i === active);
      r.classList.toggle("is-selected", i === selected);
    });
    eyes.forEach(e => e.setAttribute("aria-pressed", String(visible[Number(e.dataset.layerEye)])));
    if (slider && document.activeElement !== slider) slider.value = String(Math.round(t * 1000));
  };
  const draw = () => render(amount);

  const loop = (now: number) => {
    const dt = Math.min((now - last) / 1000, 1 / 30);
    last = now;
    spring.step(dt);
    render(spring.value);
    if (spring.settled || !win.isConnected) {
      raf = 0;
      return;
    }
    raf = requestAnimationFrame(loop);
  };

  const animateTo = (target: number) => {
    spring.target = target;
    if (reducedMotion()) {
      spring.snap();
      render(target);
      return;
    }
    if (!raf) {
      last = performance.now();
      raf = requestAnimationFrame(loop);
    }
  };

  const tween = <T extends Record<string, number>>(obj: T, to: Partial<T>, ms = 420) => {
    const from = { ...obj };
    if (reducedMotion()) {
      Object.assign(obj, to);
      draw();
      return;
    }
    const start = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      for (const key in to) (obj as Record<string, number>)[key] = from[key] + ((to[key] as number) - from[key]) * e;
      draw();
      if (k < 1 && win.isConnected) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  const select = (i: number) => {
    selected = i;
    const has = i >= 0;
    nameEl.textContent = has ? names[i] : "No layer selected";
    opacity.disabled = !has;
    resetLayerBtn.disabled = !has;
    const value = has ? Math.round(layerOpacity[i] * 100) : 100;
    opacity.value = String(value);
    opacityOut.textContent = `${value}%`;
    draw();
  };

  const resetLayer = (i: number) => {
    if (i < 0) return;
    layerOpacity[i] = 1;
    visible[i] = true;
    tween(offsets[i], { x: 0, y: 0 });
    if (i === selected) select(i);
  };
  const resetAll = () => {
    planes.forEach((_, i) => {
      layerOpacity[i] = 1;
      visible[i] = true;
      tween(offsets[i], { x: 0, y: 0 });
    });
    select(selected);
  };
  const resetView = () => tween(view, { rx: 0, rz: 0, zoom: 1, px: 0, py: 0 });

  const toLocal = (dx: number, dy: number) => {
    const m = new DOMMatrix(getComputedStyle(stack).transform);
    const o = m.transformPoint(new DOMPoint(0, 0, 0));
    const ex = m.transformPoint(new DOMPoint(1, 0, 0));
    const ey = m.transformPoint(new DOMPoint(0, 1, 0));
    const ax = ex.x - o.x, ay = ex.y - o.y, bx = ey.x - o.x, by = ey.y - o.y;
    const det = ax * by - bx * ay;
    if (Math.abs(det) < 1e-6) return { x: 0, y: 0 };
    return { x: (dx * by - bx * dy) / det, y: (ax * dy - dx * ay) / det };
  };

  const dismissHint = () => hint?.classList.add("is-hidden");
  let lastDown = { time: 0, x: 0, y: 0, index: -2 };

  stage.addEventListener("pointerdown", e => {
    if (e.button !== 0 && e.button !== 1) return;
    e.preventDefault();
    dismissHint();
    const img = (e.target as HTMLElement).closest<HTMLElement>("[data-layer-img]");
    const mode = spaceHeld || e.button === 1 ? "pan" : img ? "layer" : "orbit";
    const index = img ? Number(img.dataset.layerImg) : -1;
    const now = performance.now();
    const isDouble = e.button === 0 && !spaceHeld && now - lastDown.time < 350 && index === lastDown.index && Math.hypot(e.clientX - lastDown.x, e.clientY - lastDown.y) < 6;
    lastDown = { time: isDouble ? 0 : now, x: e.clientX, y: e.clientY, index };
    if (isDouble) {
      index >= 0 ? resetLayer(index) : resetView();
      return;
    }
    if (mode === "layer") select(index);
    stage.setPointerCapture(e.pointerId);
    stage.classList.add("is-dragging", `is-${mode}`);
    let lx = e.clientX;
    let ly = e.clientY;
    let frame = 0;
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - lx;
      const dy = ev.clientY - ly;
      lx = ev.clientX;
      ly = ev.clientY;
      if (mode === "pan") {
        view.px += dx;
        view.py += dy;
      } else if (mode === "orbit") {
        view.rz += dx * 0.35;
        view.rx = Math.max(-60, Math.min(80, view.rx - dy * 0.35));
      } else {
        const d = toLocal(dx, dy);
        offsets[index].x += d.x;
        offsets[index].y += d.y;
      }
      if (!frame) frame = requestAnimationFrame(() => {
        frame = 0;
        draw();
      });
    };
    const up = () => {
      stage.removeEventListener("pointermove", move);
      stage.removeEventListener("pointerup", up);
      stage.removeEventListener("pointercancel", up);
      stage.classList.remove("is-dragging", "is-pan", "is-orbit", "is-layer");
    };
    stage.addEventListener("pointermove", move);
    stage.addEventListener("pointerup", up);
    stage.addEventListener("pointercancel", up);
  });

  stage.addEventListener("wheel", e => {
    e.preventDefault();
    dismissHint();
    view.zoom = Math.max(0.35, Math.min(3, view.zoom * Math.exp(-e.deltaY * 0.0015)));
    draw();
  }, { passive: false });

  root.addEventListener("click", e => {
    const t = e.target as HTMLElement;
    const eye = t.closest<HTMLElement>("[data-layer-eye]");
    if (eye) {
      const i = Number(eye.dataset.layerEye);
      if (e.altKey) {
        const solo = visible.every((v, j) => v === (j === i));
        visible.forEach((_, j) => (visible[j] = solo || j === i));
      } else {
        visible[i] = !visible[i];
      }
      draw();
      return;
    }
    const pick = t.closest<HTMLElement>("[data-layer-select]");
    if (pick) {
      const i = Number(pick.dataset.layerSelect);
      select(selected === i ? -1 : i);
      return;
    }
    if (t.closest("[data-layers-reset-layer]")) resetLayer(selected);
    if (t.closest("[data-layers-reset-all]")) resetAll();
  });

  win.querySelector("[data-layers-reset-view]")?.addEventListener("click", resetView);

  opacity.addEventListener("input", () => {
    if (selected < 0) return;
    layerOpacity[selected] = Number(opacity.value) / 100;
    opacityOut.textContent = `${opacity.value}%`;
    draw();
  });

  const onKey = (e: KeyboardEvent) => {
    if (!root.isConnected) {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("keyup", onKeyUp);
      return;
    }
    if (!win.classList.contains("is-focused") || (e.target as HTMLElement).closest("input, textarea, select")) return;
    if (e.key === " ") {
      spaceHeld = true;
      stage.classList.add("is-space");
      e.preventDefault();
      return;
    }
    if (e.key === "Escape") return select(-1);
    if (e.key === "0") return resetView();
    if (selected >= 0 && e.key.startsWith("Arrow")) {
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      const d = toLocal(e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0, e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0);
      offsets[selected].x += d.x;
      offsets[selected].y += d.y;
      draw();
    }
  };
  const onKeyUp = (e: KeyboardEvent) => {
    if (e.key === " ") {
      spaceHeld = false;
      stage.classList.remove("is-space");
    }
  };
  document.addEventListener("keydown", onKey);
  document.addEventListener("keyup", onKeyUp);

  slider?.addEventListener("input", () => {
    spring.value = spring.target = Number(slider.value) / 1000;
    spring.velocity = 0;
    render(spring.value);
  });
  play?.addEventListener("click", () => animateTo(spring.target > 0.5 ? 0 : 1));

  render(0);
  whenAllReady(stack).then(() => setTimeout(() => animateTo(1), 350));
}

document.addEventListener("window:mounted", e => {
  const win = (e as CustomEvent<HTMLElement>).detail;
  initArtwork(win);
  const id = win.dataset.window;
  if (id === "layers") initLayers(win);
  if (id === "remix") initRemix(win);
  if (id === "terminal") initTerminal(win);
  if (id === "hire") initHire(win);
});
