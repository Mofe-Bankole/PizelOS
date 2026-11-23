const KEY = "pizelos:hire-draft";

const store = {
  read(): Record<string, string | string[]> | null {
    try {
      return JSON.parse(localStorage.getItem(KEY) ?? "null");
    } catch {
      return null;
    }
  },
  write(v: Record<string, string | string[]>) {
    try {
      localStorage.setItem(KEY, JSON.stringify(v));
    } catch {}
  },
};

export function initHire(win: HTMLElement) {
  const form = win.querySelector<HTMLFormElement>("[data-hire]");
  if (!form) return;
  const text = win.querySelector<HTMLElement>("[data-hire-text]")!;
  const note = win.querySelector<HTMLElement>("[data-hire-note]")!;

  const values = () => {
    const d = new FormData(form);
    const get = (k: string) => String(d.get(k) ?? "").trim();
    return {
      need: d.getAll("need").map(String),
      budget: get("budget"),
      timeline: get("timeline"),
      from: get("from"),
      project: get("project"),
      reply: get("reply"),
      refs: get("refs"),
      details: get("details"),
      via: get("via"),
    };
  };

  const compose = () => {
    const v = values();
    const lines = ["Hi Pizelxx! New commission brief:", ""];
    lines.push(`Need: ${v.need.length ? v.need.join(", ") : "…"}`);
    lines.push(`Budget: ${v.budget}`);
    lines.push(`Timeline: ${v.timeline}`);
    if (v.project) lines.push(`Project: ${v.project}`);
    if (v.reply) lines.push(`Reply to: ${v.reply}`);
    if (v.details) lines.push("", "Details:", v.details);
    if (v.refs) lines.push("", "References:", v.refs);
    lines.push("", `— ${v.from || "…"}`, `Sent from ${location.host}`);
    return lines.join("\n");
  };

  const update = () => {
    text.textContent = compose();
    const { via, ...rest } = values();
    store.write({ ...rest, via });
  };

  const restore = () => {
    const saved = store.read();
    if (!saved) return;
    for (const el of form.elements as unknown as HTMLInputElement[]) {
      if (!el.name || !(el.name in saved)) continue;
      const v = saved[el.name];
      if (el.type === "checkbox") el.checked = Array.isArray(v) && v.includes(el.value);
      else if (el.type === "radio") el.checked = el.value === v;
      else el.value = String(v);
    }
  };

  const say = (msg: string) => {
    note.textContent = msg;
    note.classList.toggle("is-visible", !!msg);
  };

  const copy = (t: string) => navigator.clipboard?.writeText(t).then(() => true, () => false) ?? Promise.resolve(false);

  const validate = () => {
    const v = values();
    const errors = { need: v.need.length === 0, from: !v.from };
    for (const [k, bad] of Object.entries(errors)) {
      form.querySelector(`[data-hire-error="${k}"]`)?.classList.toggle("is-visible", bad);
    }
    if (errors.need) form.querySelector<HTMLInputElement>('input[name="need"]')?.focus();
    else if (errors.from) form.querySelector<HTMLInputElement>('input[name="from"]')?.focus();
    return !errors.need && !errors.from;
  };

  form.addEventListener("input", () => {
    update();
    const v = values();
    if (v.need.length) form.querySelector('[data-hire-error="need"]')?.classList.remove("is-visible");
    if (v.from) form.querySelector('[data-hire-error="from"]')?.classList.remove("is-visible");
    if (!form.querySelector(".hire-error.is-visible")) say("");
  });
  form.addEventListener("change", update);

  form.addEventListener("submit", async e => {
    e.preventDefault();
    if (!validate()) {
      say("A couple of things are missing.");
      return;
    }
    const v = values();
    const body = compose();
    const channel = form.querySelector<HTMLInputElement>('input[name="via"]:checked')!;
    const href = channel.dataset.href!;
    if (v.via === "email") {
      location.href = `mailto:${href}?subject=${encodeURIComponent(`Commission brief from ${v.from}`)}&body=${encodeURIComponent(body)}`;
      say("Your mail app should open with the brief filled in.");
      return;
    }
    const copied = await copy(body);
    const where = v.via === "telegram" ? "Telegram" : "X";
    const tab = window.open(href, "_blank", "noopener");
    const first = copied ? `Brief copied. Paste it into your ${where} message to Pizelxx.` : `Copy the brief on the right, then message Pizelxx on ${where}.`;
    say(tab === null ? `${first} Your browser blocked the new tab, so allow pop-ups or use the ${where} link in About.` : first);
  });

  win.querySelector("[data-hire-copy]")?.addEventListener("click", async () => {
    say((await copy(compose())) ? "Brief copied." : "Couldn't copy automatically. Select the text and copy it.");
  });

  restore();
  update();
}
