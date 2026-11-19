interface State {
  src: string;
  opacity: number;
  scale: number;
  anchor: string;
  difference: boolean;
  dx: number;
  dy: number;
  visible: boolean;
  panel: boolean;
}

const KEY = "dev:ref-overlay";

export function initOverlay(refs: Record<string, string>) {
  const layer = document.querySelector<HTMLElement>(".ref-overlay")!;
  const img = layer.querySelector<HTMLImageElement>(".ref-image")!;
  const form = document.querySelector<HTMLFormElement>(".ref-panel")!;
  const select = form.elements.namedItem("src") as HTMLSelectElement;
  const output = form.elements.namedItem("offset") as HTMLOutputElement;

  for (const [path, url] of Object.entries(refs)) {
    select.add(new Option(path.split("/").pop()!, url));
  }

  const saved = (() => {
    try {
      return JSON.parse(localStorage.getItem(KEY) ?? "null");
    } catch {
      return null;
    }
  })();
  const state: State = {
    src: "",
    opacity: 0.5,
    scale: 1.5,
    anchor: "top-left",
    difference: false,
    dx: 0,
    dy: 0,
    visible: false,
    panel: false,
    ...saved,
  };

  function persist() {
    try {
      const { src, ...rest } = state;
      localStorage.setItem(KEY, JSON.stringify({ ...rest, src: src.startsWith("blob:") ? "" : src }));
    } catch {}
  }

  function place() {
    if (!img.naturalWidth) return;
    const w = img.naturalWidth * state.scale;
    const h = img.naturalHeight * state.scale;
    const [v, hz] = state.anchor === "center" ? ["center", "center"] : state.anchor.split("-");
    const x = hz === "left" ? 0 : hz === "right" ? innerWidth - w : (innerWidth - w) / 2;
    const y = v === "top" ? 0 : v === "bottom" ? innerHeight - h : (innerHeight - h) / 2;
    img.style.width = `${w}px`;
    img.style.height = `${h}px`;
    img.style.transform = `translate(${x + state.dx}px, ${y + state.dy}px)`;
  }

  function render() {
    layer.hidden = !state.visible || !state.src;
    form.hidden = !state.panel;
    img.style.opacity = String(state.opacity);
    img.style.mixBlendMode = state.difference ? "difference" : "normal";
    if (img.getAttribute("src") !== state.src && state.src) img.src = state.src;
    select.value = [...select.options].some(o => o.value === state.src) ? state.src : "";
    (form.elements.namedItem("opacity") as HTMLInputElement).value = String(state.opacity);
    (form.elements.namedItem("scale") as HTMLInputElement).value = String(state.scale);
    (form.elements.namedItem("anchor") as HTMLSelectElement).value = state.anchor;
    (form.elements.namedItem("difference") as HTMLInputElement).checked = state.difference;
    output.value = `offset ${state.dx}, ${state.dy}`;
    place();
    persist();
  }

  img.addEventListener("load", place);
  addEventListener("resize", place);

  form.addEventListener("input", () => {
    state.src = select.value || state.src;
    state.opacity = Number((form.elements.namedItem("opacity") as HTMLInputElement).value);
    state.scale = Number((form.elements.namedItem("scale") as HTMLInputElement).value) || 1;
    state.anchor = (form.elements.namedItem("anchor") as HTMLSelectElement).value;
    state.difference = (form.elements.namedItem("difference") as HTMLInputElement).checked;
    state.visible = true;
    render();
  });
  form.addEventListener("submit", e => e.preventDefault());

  addEventListener("dragover", e => e.preventDefault());
  addEventListener("drop", e => {
    const file = e.dataTransfer?.files[0];
    if (!file?.type.startsWith("image/")) return;
    e.preventDefault();
    state.src = URL.createObjectURL(file);
    state.visible = true;
    state.panel = true;
    render();
  });

  addEventListener("keydown", e => {
    const typing = (e.target as HTMLElement).closest("input, select, textarea");
    if (e.key === "`" && e.altKey) {
      state.panel = !state.panel;
      render();
      e.preventDefault();
    } else if (e.key === "`") {
      state.visible = !state.visible;
      render();
      e.preventDefault();
    } else if (state.visible && !typing && e.key.startsWith("Arrow")) {
      const step = e.shiftKey ? 10 : 1;
      if (e.key === "ArrowLeft") state.dx -= step;
      if (e.key === "ArrowRight") state.dx += step;
      if (e.key === "ArrowUp") state.dy -= step;
      if (e.key === "ArrowDown") state.dy += step;
      render();
      e.preventDefault();
    } else if (state.visible && !typing && e.key === "0") {
      state.dx = 0;
      state.dy = 0;
      render();
    }
  });

  render();
}
