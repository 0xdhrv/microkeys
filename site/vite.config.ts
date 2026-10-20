import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";

const r = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Always run the library from source so the site reflects local changes.
    alias: { microkeys: r("../src/index.ts") },
  },
  build: {
    rollupOptions: {
      input: {
        home: r("index.html"),
        docs: r("docs/index.html"),
        tests: r("tests/index.html"),
      },
    },
  },
  fmt: {},
  lint: {},
});
