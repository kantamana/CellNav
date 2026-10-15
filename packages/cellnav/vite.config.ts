import { defineConfig } from "vite";

// `vite` serves the demo page; `vite build` makes the one-file plugin.
export default defineConfig({
  build: {
    lib: {
      entry: "src/plugin.ts",
      name: "CellNav",
      formats: ["iife", "es"],
      fileName: (format) => `cellnav.${format}.js`,
    },
    // Inline the default font so a site needs only the one script file.
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
  },
});
