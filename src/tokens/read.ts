const cache = new Map<string, number>();

export function px(name: string): number {
  const key = `px:${name}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const probe = document.createElement("div");
  probe.style.cssText = `position:absolute;visibility:hidden;pointer-events:none;width:0;padding-left:var(${name})`;
  document.body.appendChild(probe);
  const value = parseFloat(getComputedStyle(probe).paddingLeft) || 0;
  probe.remove();
  cache.set(key, value);
  return value;
}

export function num(name: string): number {
  const key = `num:${name}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const value = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)) || 0;
  cache.set(key, value);
  return value;
}

export function clearTokenCache() {
  cache.clear();
}
