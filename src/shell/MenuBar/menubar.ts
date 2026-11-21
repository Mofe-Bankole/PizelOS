import { reducedMotion } from "../Motion/spring";
import { liquefy } from "../Glass/liquid";
import { px } from "../../tokens/read";

export function initMenuBar(bar: HTMLElement) {
  const titles = [...bar.querySelectorAll<HTMLButtonElement>(".menubar-title")];
  let open: HTMLButtonElement | null = null;

  const menuOf = (t: HTMLButtonElement) => document.getElementById(t.getAttribute("aria-controls")!)!;
  const items = (menu: HTMLElement) =>
    [...menu.querySelectorAll<HTMLElement>(".menu-item")].filter(i => i.getAttribute("aria-disabled") !== "true");

  function setActive(menu: HTMLElement, item: HTMLElement | null) {
    menu.querySelectorAll(".menu-item.is-active").forEach(i => i.classList.remove("is-active"));
    if (item) {
      item.classList.add("is-active");
      item.focus({ preventScroll: true });
    }
  }

  function show(t: HTMLButtonElement, focusFirst = false) {
    if (open === t) return;
    if (open) hide(false);
    open = t;
    const menu = menuOf(t);
    t.setAttribute("aria-expanded", "true");
    menu.hidden = false;
    const rect = menu.getBoundingClientRect();
    const overflow = rect.right - (innerWidth - 6);
    menu.style.translate = overflow > 0 ? `${-overflow}px 0` : "";
    if (focusFirst) setActive(menu, items(menu)[0] ?? null);
  }

  function hide(fade = true) {
    if (!open) return;
    const t = open;
    const menu = menuOf(t);
    open = null;
    t.setAttribute("aria-expanded", "false");
    setActive(menu, null);
    if (fade && !reducedMotion()) {
      menu.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: "ease-out" }).finished.then(() => {
        if (open !== t) menu.hidden = true;
      });
    } else {
      menu.hidden = true;
    }
  }

  titles.forEach((t, i) => {
    t.addEventListener("pointerdown", e => {
      if (e.button !== 0) return;
      e.preventDefault();
      open === t ? hide() : show(t);
    });
    t.addEventListener("pointerenter", () => {
      if (open && open !== t) show(t);
    });
    t.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        show(t, true);
      } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        titles[(i + (e.key === "ArrowRight" ? 1 : titles.length - 1)) % titles.length].focus();
      }
    });

    const menu = menuOf(t);
    liquefy(menu, { bezel: 10, strength: 22, blur: px("--glass-blur-strong") });
    menu.addEventListener("pointermove", e => {
      const item = (e.target as HTMLElement).closest<HTMLElement>(".menu-item");
      if (item && item.getAttribute("aria-disabled") !== "true") setActive(menu, item);
    });
    menu.addEventListener("pointerleave", () => setActive(menu, null));
    menu.addEventListener("click", e => {
      const item = (e.target as HTMLElement).closest<HTMLElement>(".menu-item");
      if (!item || item.getAttribute("aria-disabled") === "true") return;
      const action = item.dataset.action;
      if (action) runAction(action);
      flash(item).then(() => hide());
    });
    menu.addEventListener("keydown", e => {
      const list = items(menu);
      const index = list.indexOf(document.activeElement as HTMLElement);
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const next = e.key === "ArrowDown" ? (index + 1) % list.length : (index - 1 + list.length) % list.length;
        setActive(menu, list[next]);
      } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        const next = titles[(i + (e.key === "ArrowRight" ? 1 : titles.length - 1)) % titles.length];
        show(next, true);
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        (document.activeElement as HTMLElement)?.click();
      }
    });
  });

  document.addEventListener("pointerdown", e => {
    if (open && !(e.target as HTMLElement).closest(".menubar-slot")) hide();
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && open) {
      const t = open;
      hide();
      t.focus();
    }
  });
  addEventListener("blur", () => hide(false));

  bar.querySelectorAll<HTMLElement>(".menubar-status[data-action]").forEach(b =>
    b.addEventListener("click", () => runAction(b.dataset.action!)),
  );

  startClock(bar.querySelector<HTMLTimeElement>("[data-clock]")!);

  const appTitle = bar.querySelector<HTMLButtonElement>('[data-menu="app"]')!;
  const names: Record<string, string> = {
    work: "Work", preview: "Preview", gallery: "Gallery", layers: "Layers",
    trophies: "Trophies", about: "About", contact: "Contact", trash: "Trash",
  };
  document.addEventListener("shell:focus", e => {
    const detail = (e as CustomEvent<{ id: string } | null>).detail;
    appTitle.textContent = detail ? names[detail.id] ?? "Pizelxx" : "Pizelxx";
  });
}

function flash(item: HTMLElement): Promise<void> {
  if (reducedMotion()) return Promise.resolve();
  return item
    .animate([{ background: "transparent" }, { background: "var(--accent)" }], { duration: 70, iterations: 2, direction: "alternate" })
    .finished.then(() => {});
}

function runAction(action: string) {
  document.dispatchEvent(new CustomEvent("shell:action", { detail: action }));
  if (action === "copy-link") navigator.clipboard?.writeText(location.href);
  if (action === "fullscreen") {
    document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.();
  }
}

function startClock(el: HTMLTimeElement) {
  const fmt = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" });
  const time = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });
  const tick = () => {
    const now = new Date();
    el.textContent = `${fmt.format(now).replace(",", "")}  ${time.format(now)}`;
    el.dateTime = now.toISOString();
    setTimeout(tick, 60_000 - (now.getSeconds() * 1000 + now.getMilliseconds()) + 20);
  };
  tick();
}
