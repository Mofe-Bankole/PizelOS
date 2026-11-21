export type Tier = "high" | "medium" | "low";

const KEY = "shell:glass";
const ORDER: Tier[] = ["high", "medium", "low"];
const WINDOW = 90;
const BUDGET_MS = 22;

let samples: number[] = [];
let windows = 0;
let strikes = 0;
const listeners = new Set<(tier: Tier) => void>();

export function tier(): Tier {
  return (document.documentElement.dataset.glass as Tier) ?? "medium";
}

export function setTier(next: Tier, persist = true) {
  if (next === tier()) return;
  document.documentElement.dataset.glass = next;
  if (persist) {
    try {
      localStorage.setItem(KEY, next);
    } catch {}
  }
}

let observed = false;
function observe() {
  if (observed) return;
  observed = true;
  let previous = tier();
  new MutationObserver(() => {
    const now = tier();
    if (now === previous) return;
    previous = now;
    listeners.forEach(fn => fn(now));
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-glass"] });
}

export function onTierChange(fn: (tier: Tier) => void) {
  observe();
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function recordFrame(dt: number) {
  if (document.hidden || dt <= 0 || document.documentElement.hasAttribute("data-glass-pinned")) return;
  samples.push(dt * 1000);
  if (samples.length < WINDOW) return;
  const sorted = [...samples].sort((a, b) => a - b);
  const p90 = sorted[Math.floor(sorted.length * 0.9)];
  samples = [];
  if (++windows === 1) return;
  strikes = p90 > BUDGET_MS ? strikes + 1 : 0;
  if (strikes < 2) return;
  strikes = 0;
  const index = ORDER.indexOf(tier());
  if (index < ORDER.length - 1) setTier(ORDER[index + 1]);
}
