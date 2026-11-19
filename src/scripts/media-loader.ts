/**
 * Client side of image loading. Imported once by the base layout.
 * - paints the blurred thumbhash placeholder only when a piece gets near the screen
 * - marks a piece .is-loaded when its image arrives, which triggers the fade-in
 * - whenReady(): await this before animating an image with GSAP, so the
 *   animation doesn't stutter while the browser decodes a large image
 */
import { thumbHashToDataURL } from "thumbhash";

const bytes = (b64: string) => Uint8Array.from(atob(b64), c => c.charCodeAt(0));

// Placeholders are ~1KB data URLs each; generate them just before they're needed.
const placeholderObserver = new IntersectionObserver(entries => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    const fig = e.target as HTMLElement;
    placeholderObserver.unobserve(fig);
    const img = fig.querySelector("img");
    if (img?.complete && img.naturalWidth) continue;        // already loaded, skip placeholder
    const hash = fig.dataset.thumbhash;
    if (hash) fig.style.backgroundImage = `url(${thumbHashToDataURL(bytes(hash))})`;
  }
}, { rootMargin: "100% 0px" });

export function initArtwork(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>(".artwork:not([data-init])").forEach(fig => {
    fig.dataset.init = "";
    placeholderObserver.observe(fig);
    const img = fig.querySelector("img");
    if (!img) return;
    const done = () => fig.classList.add("is-loaded");
    if (img.complete && img.naturalWidth) done();
    else {
      img.addEventListener("load", done, { once: true });
      img.addEventListener("error", done, { once: true });
    }
  });
}

/** Resolves when the image is downloaded and decoded. Never rejects. */
export function whenReady(img: HTMLImageElement): Promise<void> {
  return img.decode().catch(() => {});
}

/** Wait for every image inside an element, e.g. a layer stack before its scroll animation. */
export function whenAllReady(root: ParentNode): Promise<void> {
  return Promise.all([...root.querySelectorAll("img")].map(whenReady)).then(() => {});
}

initArtwork();
// If page transitions (Astro's ClientRouter) are added later, re-scan after each navigation.
document.addEventListener("astro:page-load", () => initArtwork());
