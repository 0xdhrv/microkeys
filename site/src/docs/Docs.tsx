import { recordKeybinding } from "microkeys";
import { useEffect, useState, type ReactNode } from "react";
import { Binding, CodeBlock, EdgeBlur, Kbd, SoundToggle, ThemeToggle } from "../ui";

const MODIFIERS: [string, string][] = [
  ["Shift", ""],
  ["Control", "Ctrl"],
  ["Alt", "Option, Opt"],
  ["Meta", "Cmd, Command"],
  ["AltGraph", ""],
  ["$mod", "Meta on Apple devices, else Control"],
];

const BINDING_OPTIONS: [string, string, string][] = [
  ["handler", "—", "(event, { binding }) => void"],
  ["preventDefault", "global", "Call event.preventDefault() when fired"],
  ["stopPropagation", "global", "Call event.stopPropagation() when fired"],
  ["repeat", "false", "Fire on auto-repeat events"],
  ["when", "—", "Fire only if it returns true; otherwise try the next binding"],
  ["once", "false", "Remove the binding after it fires"],
];

const GLOBAL_OPTIONS: [string, string, string][] = [
  ["event", '"keydown"', 'Or "keyup"'],
  ["capture", "false", "Listen in the capture phase"],
  ["signal", "—", "AbortSignal; aborting unsubscribes"],
  ["timeout", "1000", "Max ms between presses in a sequence"],
  ["preventDefault", "false", "Default for every binding"],
  ["stopPropagation", "false", "Default for every binding"],
  ["ignore", "default", "Return true to skip an event"],
  [
    "onConflict",
    "console.warn",
    "Called when a binding yields to a longer sequence; false silences it",
  ],
  ["exclusive", "false", "Take over the keyboard while subscribed"],
];

const SECTIONS = [
  { id: "install", title: "Install" },
  { id: "usage", title: "Usage" },
  { id: "syntax", title: "Syntax" },
  { id: "binding-options", title: "Binding options" },
  { id: "global-options", title: "Global options" },
  { id: "exclusive", title: "Exclusive scopes" },
  { id: "recording", title: "Recording" },
  { id: "react", title: "React" },
  { id: "formatting", title: "Formatting" },
  { id: "lower-level", title: "Lower-level API" },
] as const;

/** Id of the last section whose top has crossed the sticky offset. */
function useActiveSection(ids: readonly string[]) {
  const [active, setActive] = useState<string>(ids[0]!);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const atEnd = innerHeight + scrollY >= document.documentElement.scrollHeight - 2;
      let current = ids[0]!;
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= 96) current = id;
      }
      setActive(atEnd ? ids.at(-1)! : current);
    };
    const onScroll = () => {
      frame ||= requestAnimationFrame(update);
    };
    update();
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      removeEventListener("scroll", onScroll);
      removeEventListener("resize", onScroll);
    };
  }, [ids]);

  return active;
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section className="doc" id={id}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function OptionTable({ rows, head }: { rows: [string, string, string][]; head: string }) {
  return (
    <table>
      <thead>
        <tr>
          <th>{head}</th>
          <th>Default</th>
          <th>Description</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([name, def, desc]) => (
          <tr key={name}>
            <td>
              <code>{name}</code>
            </td>
            <td>{def}</td>
            <td>{desc}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Records one shortcut on click and shows the binding string that matches it. */
function Recorder() {
  const [binding, setBinding] = useState<string | null>(null);
  const [recording, setRecording] = useState<AbortController | null>(null);

  useEffect(() => () => recording?.abort(), [recording]);

  const toggle = () => {
    if (recording) {
      recording.abort();
      return;
    }
    const controller = new AbortController();
    setRecording(controller);
    recordKeybinding(window, { signal: controller.signal })
      .then(setBinding, () => {})
      .finally(() => setRecording(null));
  };

  return (
    <div className="recorder">
      <span className="recorder-output" aria-live="polite">
        {recording ? (
          "Press a shortcut…"
        ) : binding ? (
          <>
            <Binding binding={binding} />
            <code>"{binding}"</code>
          </>
        ) : (
          "Record a shortcut to see its binding"
        )}
      </span>
      <button className="recorder-button" onClick={toggle}>
        {recording ? "Cancel" : "Record"}
      </button>
    </div>
  );
}

const SECTION_IDS = SECTIONS.map((s) => s.id);

export function Docs() {
  const active = useActiveSection(SECTION_IDS);
  return (
    <div className="docs">
      <EdgeBlur />
      <nav className="docs-nav" aria-label="Sections">
        <a href="/" className="docs-brand">
          microkeys
        </a>
        {SECTIONS.map((s) => (
          <a key={s.id} href={`#${s.id}`} aria-current={active === s.id ? "location" : undefined}>
            {s.title}
          </a>
        ))}
        <a href="/tests/">Tests</a>
        <a href="https://github.com/0xdhrv/microkeys">GitHub</a>
        <div className="docs-tools">
          <SoundToggle />
          <ThemeToggle />
        </div>
      </nav>

      <main className="docs-body">
        <header>
          <h1>microkeys docs</h1>
          <p>Everything microkeys exports, with bindings checked at compile time.</p>
        </header>

        <Section id="install" title="Install">
          <CodeBlock code="npm i microkeys" prompt plain />
        </Section>

        <Section id="usage" title="Usage">
          <p>
            <code>microkeys(target, bindings, options?)</code> returns an unsubscribe function.
          </p>
          <CodeBlock
            code={`import { microkeys } from "microkeys"

const unsubscribe = microkeys(window, {
  "Shift+D": () => alert("Shift and D pressed together"),
  "g i": () => goToInbox(), // sequence: g, then i
  "$mod+k": { handler: openPalette, preventDefault: true },
  "(F[1-9])": (event) => openTab(event.key), // regex key
})`}
          />
          <p>Handlers receive the event and a context carrying the matched binding.</p>
          <CodeBlock
            code={`microkeys(window, {
  "$mod+s": (event, { binding }) => {
    // event: KeyboardEvent, binding: "$mod+s" (literal type)
  },
})`}
          />
        </Section>

        <Section id="syntax" title="Syntax">
          <CodeBlock
            plain
            code={`<sequence> = <press> <press> ...       whitespace-separated
<press>    = <key> | <mods>+<key>
<mod>      = <modifier> (required) | [<modifier>] (optional)
<key>      = KeyboardEvent.key | KeyboardEvent.code  (case-insensitive)
<key>      = (<regex>)  →  /^(?:<regex>)$/i, tested against key and code`}
          />
          <table>
            <thead>
              <tr>
                <th>Modifier</th>
                <th>Aliases (case-insensitive)</th>
              </tr>
            </thead>
            <tbody>
              {MODIFIERS.map(([name, aliases]) => (
                <tr key={name}>
                  <td>
                    <code>{name}</code>
                  </td>
                  <td>{aliases || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            A modifier that isn't in the binding blocks the match: <code>a</code> doesn't fire on{" "}
            <span className="kbd-row">
              <Kbd>⇧</Kbd>
              <Kbd>A</Kbd>
            </span>{" "}
            unless it's optional, as in <code>[Shift]+a</code>. Shifted symbols need Shift spelled
            out: <code>Shift+?</code>, not <code>?</code>.
          </p>
          <p>
            Literal bindings are type-checked. <code>"Hyper+k"</code> and <code>"Shift+"</code> fail
            to compile; computed strings that slip through throw a <code>SyntaxError</code> when the
            handler is created.
          </p>
          <p>
            Letters match the character typed, so <code>$mod+z</code> follows the Z key on AZERTY
            and Dvorak. When the typed character isn't ASCII (Russian <code>я</code>, or{" "}
            <code>å</code> from Option+A on macOS), the letter or digit of the physical key is used
            instead, so <code>Control+s</code> and <code>Alt+a</code> still work. Write{" "}
            <code>KeyZ</code> to bind the physical key.
          </p>
          <p>
            On Windows, AltGr reports as Control+Alt. A character typed with AltGr (<code>@</code>{" "}
            on a German keyboard) doesn't fire a <code>Control+Alt+KeyQ</code> binding. Bind it with{" "}
            <code>AltGraph+KeyQ</code> or <code>Control+Alt+@</code>.
          </p>
        </Section>

        <Section id="binding-options" title="Binding options">
          <p>A binding's value is a handler or a config object.</p>
          <CodeBlock
            code={`microkeys(window, {
  ArrowDown: { handler: next, repeat: true }, // fire while held
  Enter: { handler: save, when: () => isEditing }, // falls through when false
  enter: open, // runs when the binding above doesn't
  "Shift+?": { handler: showHelp, once: true },
  Escape: { handler: close, preventDefault: true, stopPropagation: true },
})`}
          />
          <OptionTable rows={BINDING_OPTIONS} head="Option" />
        </Section>

        <Section id="global-options" title="Global options">
          <OptionTable rows={GLOBAL_OPTIONS} head="Option" />
          <p>
            The default <code>ignore</code> leaves keys to the browser or the focused control when
            they belong there:
          </p>
          <ul>
            <li>During IME composition: every key.</li>
            <li>
              In inputs, textareas, selects, and contenteditable: typing. <code>$mod</code> and{" "}
              <code>Control</code> combos, <code>Escape</code>, and F-keys still fire, except text
              editing ones like <code>$mod+a</code>, <code>$mod+c</code>, and <code>$mod+z</code>.
            </li>
            <li>
              On buttons, links, and checkboxes: plain <code>Enter</code> and <code>Space</code>.
            </li>
            <li>
              Inside menus, listboxes, grids, and tablists: plain arrow keys, unless the listener is
              on that widget.
            </li>
          </ul>
          <p>It never ignores events whose target is the listener's own target. To extend it:</p>
          <CodeBlock
            code={`import { defaultKeybindingsHandlerIgnore } from "microkeys"

microkeys(window, bindings, {
  ignore: (e) =>
    defaultKeybindingsHandlerIgnore(e) || (e.target as Element).closest("dialog") != null,
})`}
          />
        </Section>

        <Section id="exclusive" title="Exclusive scopes">
          <p>
            A dialog can take over the keyboard. While an <code>exclusive</code> subscription is
            active, every other subscription pauses, so <code>Escape</code> closes the dialog
            without also reaching the page. Exclusive subscriptions stack: the newest wins, and the
            previous one resumes when it unsubscribes.
          </p>
          <CodeBlock
            code={`function openDialog() {
  const close = microkeys(window, { Escape: () => close() }, { exclusive: true })
}`}
          />
        </Section>

        <Section id="recording" title="Recording shortcuts">
          <Recorder />
          <CodeBlock
            code={`import { recordKeybinding, keybindingFromEvent } from "microkeys"

const binding = await recordKeybinding() // user presses ⌘⇧K → "$mod+Shift+k"
microkeys(window, { [binding]: run })

recordKeybinding(window, { signal: controller.signal, mod: false }) // "Meta+Shift+k"
keybindingFromEvent(event) // same conversion for your own listener`}
          />
          <p>
            <code>recordKeybinding</code> waits for a non-modifier key, then{" "}
            <code>preventDefault</code>s it. The result matches the press that produced it.
          </p>
        </Section>

        <Section id="react" title="React">
          <CodeBlock
            code={`import { useKeybinding, useKeybindings } from "microkeys/react"

function Editor() {
  const ref = useRef<HTMLDivElement>(null)
  useKeybindings({
    "$mod+s": { handler: save, preventDefault: true },
    "g i": goToInbox,
  })
  useKeybinding("Escape", close, {
    target: ref,
    exclusive: true,
    enabled: isOpen,
  })
  return <div ref={ref} />
}`}
          />
          <p>
            Hooks take every global option, plus <code>target</code> (an element or ref, default{" "}
            <code>window</code>) and <code>enabled</code>. Handlers, <code>when</code>,{" "}
            <code>ignore</code>, and <code>onConflict</code> always use the latest render, so inline
            functions don't resubscribe. Other per-binding options apply when the listener is
            created.
          </p>
        </Section>

        <Section id="formatting" title="Formatting">
          <p>
            <code>formatKeybinding</code> turns a binding into display text, with Apple symbols on
            macOS and iOS.
          </p>
          <CodeBlock
            code={`import { formatKeybinding } from "microkeys"

formatKeybinding("$mod+Shift+k") // "⇧⌘K" on macOS, "Ctrl+Shift+K" elsewhere
formatKeybinding("g i") // "G I"
formatKeybinding("Control+Enter", { apple: true }) // "⌃↩"
formatKeybinding("g i", { sequenceSeparator: " then " }) // "G then I"`}
          />
        </Section>

        <Section id="lower-level" title="Lower-level API">
          <CodeBlock
            code={`import { createKeybindingsHandler } from "microkeys"

const listener = createKeybindingsHandler({ "g i": goToInbox })
element.addEventListener("keydown", listener)
listener.reset() // clear in-progress sequences`}
          />
          <p>
            Also exported: <code>parseKeybinding</code>, <code>matchKeybindingPress</code>,{" "}
            <code>eventModifiers</code>, <code>IS_APPLE</code>, and the types{" "}
            <code>Keybindings</code>, <code>KeybindingConfig</code>, <code>IsValidKeybinding</code>.
          </p>
        </Section>
      </main>
    </div>
  );
}
