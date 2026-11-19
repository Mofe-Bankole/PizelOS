// @ts-check
import { defineConfig } from "astro/config";

export default defineConfig({
  // Images are pre-processed by `npm run assets`, so Astro's own image pipeline isn't used.
  build: { inlineStylesheets: "auto" },
});
