// @ts-check
import { defineConfig } from "astro/config";

const BUILD_ID = Date.now().toString(36);

export default defineConfig({
  build: { inlineStylesheets: "auto" },
  vite: { define: { __BUILD_ID__: JSON.stringify(BUILD_ID) } },
});
