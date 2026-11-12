import { defaultKeybindingsHandlerIgnore, eventModifiers, IS_APPLE, microkeys } from "microkeys";
import { TextMorph } from "torph/react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Binding, ForPlatform, Kbd } from "../ui";
import { Confetti } from "./Confetti";

/** microkeys' default gap allowed between sequence presses. */
const SEQUENCE_TIMEOUT = 1000;
const HELD_MODIFIER = /^(Shift|Meta|Alt|Control|AltGraph)$/;

/**
 * The display-only trackers below mirror what microkeys does with a press, so
 * they never show progress microkeys wouldn't make: editable targets and key
 * repeats are skipped, a lone modifier keeps the sequence alive, and any other
 * modifier means the press can't match a bare key.
 */
function plainKey(e: KeyboardEvent): string | null | undefined {
  if (e.repeat || defaultKeybindingsHandlerIgnore(e)) return undefined;
  if (HELD_MODIFIER.test(e.key)) return undefined;
  return eventModifiers(e) === 0 ? e.key.toLowerCase() : null;
}

const COMMANDS = ["New file", "Open recent", "Toggle sidebar", "Settings"];

export function PaletteDemo() {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [ran, setRan] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const indexRef = useRef(0);
  indexRef.current = index;

  useEffect(
    () =>
      microkeys(window, {
        "$mod+k": {
          handler: () => setOpen((o) => !o),
          preventDefault: true,
        },
      }),
    [],
  );

  useEffect(() => {
    const el = input.current;
    if (!open || !el) return;
    el.focus();
    setIndex(0);
    const move = (delta: number) =>
      setIndex((i) => (i + delta + COMMANDS.length) % COMMANDS.length);
    // Bound to the input: the default `ignore` allows events whose target
    // is the listener's own element.
    return microkeys(
      el,
      {
        ArrowDown: { handler: () => move(1), repeat: true },
        ArrowUp: { handler: () => move(-1), repeat: true },
        Escape: () => setOpen(false),
        "$mod+k": () => setOpen(false),
        Enter: () => {
          setRan(COMMANDS[indexRef.current] ?? null);
          setOpen(false);
        },
      },
      { preventDefault: true },
    );
  }, [open]);

  useEffect(() => {
    if (!ran) return;
    const t = setTimeout(() => setRan(null), 1400);
    return () => clearTimeout(t);
  }, [ran]);

  return (
    <div className="demo demo-wide" onClick={() => !open && setOpen(true)}>
      {open ? (
        <div className="palette" onClick={(e) => e.stopPropagation()}>
          <input
            ref={input}
            className="palette-input"
            placeholder="Type a command…"
            aria-label="Command"
            role="combobox"
            aria-expanded
            aria-controls="palette-list"
            aria-activedescendant={`palette-${index}`}
            onBlur={() => setOpen(false)}
          />
          <ul className="palette-list" id="palette-list" role="listbox" aria-label="Commands">
            {COMMANDS.map((cmd, i) => (
              <li
                key={cmd}
                id={`palette-${i}`}
                role="option"
                aria-selected={i === index}
                className="palette-item"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setRan(cmd);
                  setOpen(false);
                }}
              >
                {cmd}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="demo-idle">
          <Binding binding="$mod+k" size="lg" />
          <span className="demo-hint" aria-live="polite">
            <TextMorph duration={260}>{ran ? `Ran “${ran}”` : "Command palette"}</TextMorph>
          </span>
        </div>
      )}
    </div>
  );
}

// Visitors press G, then look at the keycaps before the second key, so this
// demo allows more than microkeys' default 1s between presses.
const GOTO_TIMEOUT = 2000;

const PAGES = [
  ["Inbox", "i"],
  ["Starred", "s"],
  ["Drafts", "d"],
] as const;

export function SequenceDemo() {
  const [page, setPage] = useState(0);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    // Display-only: shows the first press of the sequence as "held".
    const onKey = (e: KeyboardEvent) => {
      const key = plainKey(e);
      if (key === undefined) return;
      clearTimeout(timer);
      const isG = key === "g";
      setPending(isG);
      if (isG) timer = setTimeout(() => setPending(false), GOTO_TIMEOUT);
    };
    window.addEventListener("keydown", onKey);
    const off = microkeys(
      window,
      Object.fromEntries(PAGES.map(([, key], i) => [`g ${key}`, () => setPage(i)])),
      { timeout: GOTO_TIMEOUT },
    );
    return () => {
      off();
      clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div className="demo">
      <div className="seq">
        <div className="seq-tabs" style={{ "--i": page } as CSSProperties}>
          <span className="seq-indicator" aria-hidden />
          {PAGES.map(([name], i) => (
            <button
              key={name}
              className="seq-tab"
              aria-pressed={i === page}
              onClick={() => setPage(i)}
            >
              {name}
            </button>
          ))}
        </div>
        <div className="kbd-row">
          <Kbd active={pending}>G</Kbd>
          <span className="kbd-then">then</span>
          {PAGES.map(([, key], i) => (
            <Kbd key={key} done={i === page}>
              {key.toUpperCase()}
            </Kbd>
          ))}
        </div>
      </div>
    </div>
  );
}

const APPLE_MODS = [
  ["⌃", 8, "Control"],
  ["⌥", 4, "Alt"],
  ["⇧", 1, "Shift"],
  ["⌘", 2, "Meta"],
] as const;
const OTHER_MODS = [
  ["Ctrl", 8, "Control"],
  ["Alt", 4, "Alt"],
  ["Shift", 1, "Shift"],
  ["Win", 2, "Meta"],
] as const;
const MODS = IS_APPLE ? APPLE_MODS : OTHER_MODS;

function ModifierKeys({
  mods,
  held,
}: {
  mods: typeof APPLE_MODS | typeof OTHER_MODS;
  held: number;
}) {
  return (
    <div className="kbd-row">
      {mods.map(([label, bit]) => (
        <Kbd key={label} size="lg" active={(held & bit) !== 0}>
          {label}
        </Kbd>
      ))}
    </div>
  );
}

const MODIFIER_KEYS = new Set(["Shift", "Meta", "Alt", "Control", "AltGraph", "CapsLock"]);

export function ModifiersDemo() {
  const [mods, setMods] = useState(0);
  const [key, setKey] = useState<string | null>(null);

  useEffect(() => {
    const update = (e: KeyboardEvent) => {
      setMods(eventModifiers(e));
      if (e.type === "keydown" && !e.repeat && !MODIFIER_KEYS.has(e.key)) {
        setKey(e.key === " " ? "Space" : e.key);
      }
    };
    const clear = () => setMods(0);
    window.addEventListener("keydown", update);
    window.addEventListener("keyup", update);
    window.addEventListener("blur", clear);
    return () => {
      window.removeEventListener("keydown", update);
      window.removeEventListener("keyup", update);
      window.removeEventListener("blur", clear);
    };
  }, []);

  const binding = [
    ...MODS.filter(([, bit]) => mods & bit).map(([, , name]) => name),
    key ?? "…",
  ].join("+");

  return (
    <div className="demo">
      <div className="mods">
        <ForPlatform
          apple={<ModifierKeys mods={APPLE_MODS} held={mods} />}
          other={<ModifierKeys mods={OTHER_MODS} held={mods} />}
        />
        {key || mods ? (
          <code className="mods-binding">
            <TextMorph duration={160}>{binding}</TextMorph>
          </code>
        ) : (
          <span className="demo-hint">Hold any modifier</span>
        )}
      </div>
    </div>
  );
}

const KONAMI = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "b",
  "a",
];
const ARROWS: Record<string, string> = {
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
};

export function KonamiDemo() {
  const [progress, setProgress] = useState(0);
  const [won, setWon] = useState(0);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    // Display-only progress; microkeys owns the actual match below.
    const onKey = (e: KeyboardEvent) => {
      const key = plainKey(e);
      if (key === undefined) return;
      clearTimeout(timer);
      timer = setTimeout(() => setProgress(0), SEQUENCE_TIMEOUT);
      setProgress((p) => {
        if (key === KONAMI[p]?.toLowerCase()) return p + 1;
        return key === KONAMI[0]!.toLowerCase() ? 1 : 0;
      });
    };
    window.addEventListener("keydown", onKey);
    const off = microkeys(window, {
      [KONAMI.join(" ")]: () => {
        setWon((n) => n + 1);
        setProgress(0);
      },
    });
    return () => {
      off();
      clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div className="demo demo-wide demo-short">
      <Confetti button={false} trigger={won} width={640} height={280} />
      <div className="konami">
        <div className="kbd-row konami-keys">
          {KONAMI.map((key, i) => (
            <Kbd key={i} done={i < progress}>
              {ARROWS[key] ?? key.toUpperCase()}
            </Kbd>
          ))}
        </div>
        <span className="demo-hint" aria-live="polite">
          {won ? (
            <span key={won} className="konami-win">
              +30 lives{won > 1 ? ` ×${won}` : ""}
            </span>
          ) : (
            "10-key sequence"
          )}
        </span>
      </div>
    </div>
  );
}
