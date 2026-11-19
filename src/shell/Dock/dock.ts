import { num, px } from "../../tokens/read";
import { Spring, reducedMotion, springEasing } from "../Motion/spring";

interface Slot {
  el: HTMLElement;
  scaleEl: HTMLElement | null;
  center: number;
  left: number;
  icon: boolean;
}

export function initDock(dock: HTMLElement) {
  const row = dock.querySelector<HTMLElement>(".dock-row")!;
  const plate = dock.querySelector<HTMLElement>(".dock-plate")!;
  const tooltip = dock.querySelector<HTMLElement>(".dock-tooltip")!;

  let base = 0;
  let magnify = 1;
  let range = 0;
  let plateWidth = 0;
  let radius = 0;
  let padY = 0;
  let gap = 0;
  let slots: Slot[] = [];
  const pointer = new Spring(0, { stiffness: num("--spring-dock-stiffness"), damping: num("--spring-dock-damping") });
  const intensity = new Spring(0, {
    stiffness: num("--spring-dock-intensity-stiffness"),
    damping: num("--spring-dock-intensity-damping"),
  });
  let hovered: HTMLElement | null = null;
  let raf = 0;
  let last = 0;

  function measure() {
    base = px("--dock-icon");
    magnify = reducedMotion() ? 1 : num("--dock-magnify");
    range = num("--dock-magnify-range") * (base + px("--dock-gap"));
    radius = px("--dock-radius");
    padY = px("--dock-pad-y");
    gap = px("--dock-tooltip-gap");
    plateWidth = row.offsetWidth;
    slots = [...row.children].map(el => {
      const e = el as HTMLElement;
      return {
        el: e,
        scaleEl: e.querySelector<HTMLElement>(".dock-scale"),
        left: e.offsetLeft,
        center: e.offsetLeft + e.offsetWidth / 2,
        icon: e.classList.contains("dock-item"),
      };
    });
  }

  function falloff(d: number) {
    const x = Math.min(Math.abs(d) / range, 1);
    return (Math.cos(x * Math.PI) + 1) / 2;
  }

  function render() {
    const I = intensity.value;
    const p = pointer.value;
    const scales = slots.map(s => (s.icon ? 1 + (magnify - 1) * Math.max(0, I) * falloff(p - s.center) : 1));
    const extras = scales.map(s => base * (s - 1));

    let cumAtPointer = 0;
    slots.forEach((s, i) => {
      const width = s.icon ? base : s.el.offsetWidth;
      cumAtPointer += extras[i] * Math.min(Math.max((p - s.left) / width, 0), 1);
    });

    let cum = 0;
    let tipX = 0;
    let tipY = 0;
    slots.forEach((s, i) => {
      const shift = cum - cumAtPointer;
      s.el.style.transform = `translate3d(${shift}px,0,0)`;
      if (s.scaleEl) s.scaleEl.style.transform = scales[i] === 1 ? "" : `scale(${scales[i]})`;
      if (s.el === hovered) {
        tipX = s.left + shift + (base * scales[i]) / 2;
        tipY = base * scales[i];
      }
      cum += extras[i];
    });

    const total = cum;
    const sx = (plateWidth + total) / plateWidth;
    plate.style.transform = `translate3d(${-cumAtPointer}px,0,0) scaleX(${sx})`;
    plate.style.borderRadius = `${radius / sx}px / ${radius}px`;

    if (hovered) {
      const name = hovered.querySelector<HTMLElement>("[data-name]")?.dataset.name ?? "";
      if (tooltip.textContent !== name) tooltip.textContent = name;
      const x = tipX - tooltip.offsetWidth / 2;
      const y = Math.min(-gap * 0.5, padY + base - tipY - gap);
      tooltip.style.transform = `translate3d(${x}px,${y}px,0)`;
    }
  }

  function frame(t: number) {
    const dt = Math.min((t - last) / 1000, 1 / 30);
    last = t;
    pointer.step(dt);
    intensity.step(dt);
    render();
    if (pointer.settled && intensity.settled) {
      raf = 0;
      return;
    }
    raf = requestAnimationFrame(frame);
  }

  function kick() {
    if (raf) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function setTooltip(visible: boolean) {
    tooltip.getAnimations().forEach(a => a.cancel());
    tooltip.style.opacity = visible ? "1" : "0";
    if (visible && !reducedMotion()) tooltip.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 120 });
  }

  row.addEventListener("pointermove", e => {
    if (e.pointerType === "touch") return;
    const restX = e.clientX - row.getBoundingClientRect().left;
    if (intensity.target === 0) pointer.value = restX;
    pointer.target = restX;
    intensity.target = 1;
    const item = (e.target as HTMLElement).closest<HTMLElement>(".dock-item");
    if (item !== hovered) {
      hovered = item;
      setTooltip(!!item);
    }
    kick();
  });

  dock.addEventListener("pointerleave", () => {
    intensity.target = 0;
    hovered = null;
    setTooltip(false);
    kick();
  });

  row.addEventListener("click", e => {
    const button = (e.target as HTMLElement).closest<HTMLElement>(".dock-button");
    const item = button?.closest<HTMLElement>(".dock-item");
    if (!button || !item) return;
    const external = button.getAttribute("target") === "_blank";
    if (!external && button.tagName === "A") e.preventDefault();
    bounce(item, external ? 1 : 2);
    if (!external && item.dataset.app !== "trash") {
      item.classList.add("is-running");
      document.dispatchEvent(new CustomEvent("shell:open", { detail: { app: item.dataset.app, href: button.getAttribute("href") } }));
    }
  });

  function bounce(item: HTMLElement, times: number) {
    if (reducedMotion()) return;
    const el = item.querySelector<HTMLElement>(".dock-bounce")!;
    if (el.getAnimations().length) return;
    const height = base * num("--dock-bounce-height");
    const up = springEasing({ stiffness: num("--spring-bounce-stiffness"), damping: 26 });
    const frames: Keyframe[] = [];
    for (let i = 0; i < times; i++) {
      frames.push({ transform: "translateY(0)", easing: "cubic-bezier(.2,.7,.3,1)" });
      frames.push({ transform: `translateY(${-height}px)`, easing: "cubic-bezier(.6,0,.85,.5)" });
    }
    frames.push({ transform: "translateY(0)" });
    el.animate(frames, { duration: Math.max(up.duration, 280) * times * 1.6, easing: "linear" });
  }

  measure();
  render();
  addEventListener("resize", () => {
    measure();
    render();
  });
  document.fonts?.ready.then(() => {
    measure();
    render();
  });
}
