// @ts-check
import { defineConfig } from "astro/config";

const BUILD_ID = Date.now().toString(36);

export default defineConfig({
  site: "https://pizelos.pages.dev",
  trailingSlash: "never",
  build: { inlineStylesheets: "auto", format: "file" },
  vite: { define: { __BUILD_ID__: JSON.stringify(BUILD_ID) } },
});
