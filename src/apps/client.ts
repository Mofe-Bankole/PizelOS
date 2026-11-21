import { initArtwork, whenAllReady } from "../scripts/media-loader";
import { open } from "../shell/Window/window-manager";
import { Spring, reducedMotion } from "../shell/Motion/spring";

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

  const toggle = t.closest<HTMLElement>("[data-layer-toggle]");
  if (toggle) {
    const win = toggle.closest(".window")!;
    const on = toggle.getAttribute("aria-pressed") !== "true";
    toggle.setAttribute("aria-pressed", String(on));
    win.querySelector(`[data-layer-index="${toggle.dataset.layerToggle}"]`)?.classList.toggle("is-off", !on);
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
  const stack = root.querySelector<HTMLElement>("[data-layers-stack]")!;
  const planes = [...stack.querySelectorAll<HTMLElement>(".layers-plane")];
  const flat = stack.querySelector<HTMLElement>("[data-layers-flat]")!;
  const rows = [...root.querySelectorAll<HTMLElement>("[data-layer-row]")];
  const slider = win.querySelector<HTMLInputElement>("[data-layers-amount]");
  const play = win.querySelector<HTMLElement>("[data-layers-play]");
  const spring = new Spring(0, { stiffness: 70, damping: 16 });
  let raf = 0;
  let last = 0;

  const render = (a: number) => {
    const H = stack.offsetHeight;
    const total = H * Math.min(0.16 * (planes.length - 1), 0.85);
    const gap = total / Math.max(1, planes.length - 1);
    const t = Math.max(0, Math.min(1, a));
    stack.style.transform = `translateY(${t * total * 0.32}px) rotateX(${56 * t}deg) rotateZ(${-32 * t}deg) scale(${1 - 0.36 * t})`;
    flat.style.opacity = String(Math.max(0, 1 - t * 6));
    planes.forEach((p, i) => {
      const lift = Math.max(0, Math.min(1, t * planes.length - i * 0.6));
      p.style.transform = `translateZ(${i * gap * (0.25 * t + 0.75 * lift)}px)`;
      p.style.setProperty("--frame", String(Math.max(0, Math.min(1, (t - 0.15) * 3))));
    });
    const active = Math.min(planes.length - 1, Math.floor(t * planes.length));
    rows.forEach(r => r.classList.toggle("is-active", t > 0.05 && Number(r.dataset.layerRow) === active));
    if (slider && document.activeElement !== slider) slider.value = String(Math.round(t * 1000));
  };

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

  slider?.addEventListener("input", () => {
    spring.value = spring.target = Number(slider.value) / 1000;
    spring.velocity = 0;
    render(spring.value);
  });
  play?.addEventListener("click", () => animateTo(spring.target > 0.5 ? 0 : 1));
  rows.forEach(r =>
    r.addEventListener("pointerenter", () => {
      planes[Number(r.dataset.layerRow)]?.style.setProperty("--frame", "1");
    }),
  );

  render(0);
  whenAllReady(stack).then(() => setTimeout(() => animateTo(1), 350));
}

document.addEventListener("window:mounted", e => {
  const win = (e as CustomEvent<HTMLElement>).detail;
  initArtwork(win);
  if (win.dataset.window === "layers") initLayers(win);
});
