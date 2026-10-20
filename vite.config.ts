import { fileURLToPath } from "node:url";
import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: ["src/index.ts", "src/react.ts"],
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    minify: true,
    target: "es2022",
    platform: "neutral",
  },
  test: {
    // React is an optional peer; run hook tests against the site workspace's copy.
    alias: {
      "react-dom/client": fileURLToPath(
        new URL("site/node_modules/react-dom/client.js", import.meta.url),
      ),
      react: fileURLToPath(new URL("site/node_modules/react", import.meta.url)),
    },
    environment: "happy-dom",
    clearMocks: true,
    typecheck: { enabled: true, include: ["test/**/*.test-d.ts"] },
  },
  fmt: {},
  lint: {
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    options: { typeAware: true, typeCheck: true },
  },
});
