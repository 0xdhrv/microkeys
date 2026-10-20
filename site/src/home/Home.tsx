import { useState } from "react";
import { CodeBlock, EdgeBlur, KeySounds, SoundToggle, Tabs, ThemeToggle } from "../ui";
import { KonamiDemo, ModifiersDemo, PaletteDemo, SequenceDemo } from "./demos";

const MANAGERS = ["npm", "pnpm", "yarn", "bun"] as const;
const INSTALL: Record<(typeof MANAGERS)[number], string> = {
  npm: "npm i microkeys",
  pnpm: "pnpm add microkeys",
  yarn: "yarn add microkeys",
  bun: "bun add microkeys",
};

const FLAVORS = ["TypeScript", "React", "Options", "Format"] as const;
const USAGE: Record<(typeof FLAVORS)[number], string> = {
  TypeScript: `import { microkeys } from "microkeys"

const unsubscribe = microkeys(window, {
  "$mod+k": () => openPalette(),
  "g i": () => goTo("/inbox"),
  "Shift+(F[1-9])": (event) => openTab(event.key),
  "Hyper+q": quit, // Type error: "Hyper" isn't a modifier
})`,
  React: `import { microkeys } from "microkeys"
import { useEffect } from "react"

export function useHotkeys(...args: Parameters<typeof microkeys>) {
  useEffect(() => microkeys(...args), args)
}`,
  Options: `microkeys(window, {
  "$mod+s": { handler: save, preventDefault: true },
  ArrowDown: { handler: next, repeat: true },
  Enter: { handler: commit, when: () => editing },
  "Shift+?": { handler: showHelp, once: true },
}, { signal: controller.signal })`,
  Format: `import { formatKeybinding } from "microkeys"

formatKeybinding("$mod+Shift+k") // "⇧⌘K" on macOS
                                 // "Ctrl+Shift+K" elsewhere`,
};

export function Home() {
  const [manager, setManager] = useState<(typeof MANAGERS)[number]>("npm");
  const [flavor, setFlavor] = useState<(typeof FLAVORS)[number]>("TypeScript");

  return (
    <main className="home">
      <EdgeBlur />
      <KeySounds />
      <header className="home-header">
        <div>
          <h1>microkeys</h1>
          <p>Keyboard shortcuts TypeScript can check. About 2 kB, inspired by tinykeys.</p>
        </div>
        <div className="header-actions">
          <SoundToggle />
          <ThemeToggle />
        </div>
      </header>

      <section className="grid" aria-label="Demos">
        <PaletteDemo />
        <SequenceDemo />
        <ModifiersDemo />
        <KonamiDemo />
      </section>

      <section className="section">
        <h2>Install</h2>
        <Tabs tabs={MANAGERS} value={manager} onChange={setManager} label="Package manager" />
        <CodeBlock code={INSTALL[manager]} prompt plain />
      </section>

      <section className="section">
        <h2>Usage</h2>
        <Tabs tabs={FLAVORS} value={flavor} onChange={setFlavor} label="Usage example" />
        <CodeBlock code={USAGE[flavor]} />
      </section>

      <footer className="footer">
        <span>
          Made by{" "}
          <a href="https://dhrv.pw" className="footer-strong">
            dhrv
          </a>{" "}
          · <a href="https://x.com/0xdhrv">@0xdhrv</a>
        </span>
        <nav>
          <span>v0.1.0</span>
          <a href="/docs/">Docs</a>
          <a href="https://github.com/0xdhrv/microkeys">GitHub</a>
          <a href="https://www.npmjs.com/package/microkeys">npm</a>
          <a href="/tests/">Tests</a>
        </nav>
      </footer>
    </main>
  );
}
