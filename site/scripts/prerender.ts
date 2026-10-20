import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { createServer } from "vite-plus";

const root = fileURLToPath(new URL("..", import.meta.url));

const PAGES = [
  { file: "dist/index.html", module: "/src/home/Home.tsx", component: "Home" },
  { file: "dist/docs/index.html", module: "/src/docs/Docs.tsx", component: "Docs" },
];

const server = await createServer({
  root,
  appType: "custom",
  server: { middlewareMode: true },
  logLevel: "error",
});

try {
  for (const { file, module, component } of PAGES) {
    const mod = await server.ssrLoadModule(module);
    const html = renderToString(createElement(mod[component]));
    const path = `${root}${file}`;
    const page = await readFile(path, "utf8");
    if (!page.includes('<div id="root"></div>')) throw new Error(`${file}: root marker missing`);
    await writeFile(path, page.replace('<div id="root"></div>', `<div id="root">${html}</div>`));
    console.log(`prerendered ${file}`);
  }
} finally {
  await server.close();
}
