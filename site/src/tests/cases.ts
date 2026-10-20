import { IS_APPLE, type KeybindingConfig, type KeybindingOptions } from "microkeys";

export type Target = "host" | "input" | "textarea" | "select" | "contenteditable";

export interface Press {
  key: string;
  code: string;
  shift?: boolean;
  ctrl?: boolean;
  alt?: boolean;
  meta?: boolean;
  altGraph?: boolean;
  repeat?: boolean;
  composing?: boolean;
  type?: "keydown" | "keyup";
  /** Element the event is dispatched from. Default: the listener's host. */
  on?: Target;
  /** Real milliseconds to wait before dispatching. */
  wait?: number;
}

export interface Step {
  press: Press;
  /** Bindings expected to fire on this step, in order. */
  expect: string[];
  /** Expected `event.defaultPrevented`. */
  prevented?: boolean;
  /** Expected to stop propagation past the host. */
  stopped?: boolean;
}

export interface Case {
  id: string;
  group: string;
  title: string;
  tags: string[];
  description: string;
  bindings: Record<string, Omit<KeybindingConfig, "handler">>;
  options?: Omit<KeybindingOptions, "signal" | "onConflict">;
  steps: Step[];
  /** Creating the handler must throw an error matching this. */
  throws?: RegExp;
}

type Mods = "shift" | "ctrl" | "alt" | "meta" | "altGraph" | "mod";

function codeFor(key: string): string {
  if (/^[a-z]$/i.test(key)) return `Key${key.toUpperCase()}`;
  if (/^\d$/.test(key)) return `Digit${key}`;
  if (key === " ") return "Space";
  if (key === "+") return "Equal";
  if (key === "Shift" || key === "Control" || key === "Alt" || key === "Meta") return `${key}Left`;
  return key;
}

/** Builds a press: `p("a", "shift")`, `p("€", "altGraph", { code: "KeyE" })`. */
function p(key: string, mods = "", extra: Partial<Press> = {}): Press {
  const press: Press = { key, code: codeFor(key) };
  for (const mod of mods.split(/\s+/).filter(Boolean) as Mods[]) {
    if (mod === "mod") press[IS_APPLE ? "meta" : "ctrl"] = true;
    else press[mod] = true;
  }
  return { ...press, ...extra };
}

/** One step per character, nothing expected except on the last. */
function typed(keys: string, last: string[] = []): Step[] {
  return [...keys].map((key, i) => ({
    press: p(key),
    expect: i === keys.length - 1 ? last : [],
  }));
}

export const CASES: Case[] = [
  // ------------------------------------------------------------- keys
  {
    id: "key",
    group: "Keys",
    title: "Match by event.key",
    tags: ["KEY"],
    description: "A bare letter matches KeyboardEvent.key.",
    bindings: { a: {} },
    steps: [{ press: p("a"), expect: ["a"] }],
  },
  {
    id: "code",
    group: "Keys",
    title: "Match by event.code",
    tags: ["CODE"],
    description: "Physical key codes work too, independent of layout.",
    bindings: { KeyA: {} },
    steps: [{ press: p("a"), expect: ["KeyA"] }],
  },
  {
    id: "case-insensitive",
    group: "Keys",
    title: "Case-insensitive keys",
    tags: ["KEY"],
    description: "`escape` matches the Escape key; `keya` matches code KeyA.",
    bindings: { escape: {}, keya: {} },
    steps: [
      { press: p("Escape"), expect: ["escape"] },
      { press: p("a"), expect: ["keya"] },
    ],
  },
  {
    id: "regex",
    group: "Keys",
    title: "Regex keys",
    tags: ["REGEX"],
    description: "`(F[1-9])` matches F1–F9 but not F10: regexes are anchored.",
    bindings: { "(F[1-9])": {} },
    steps: [
      { press: p("F1"), expect: ["(F[1-9])"] },
      { press: p("F9"), expect: ["(F[1-9])"] },
      { press: p("F10"), expect: [] },
    ],
  },
  {
    id: "space",
    group: "Keys",
    title: "Space by code",
    tags: ["CODE"],
    description: 'The space key\'s event.key is " ", so bind it by code: `Space`.',
    bindings: { Space: {} },
    steps: [{ press: p(" "), expect: ["Space"] }],
  },
  {
    id: "plus",
    group: "Keys",
    title: "Plus as a key",
    tags: ["PARSE"],
    description: "`Shift++` parses as Shift with the + key.",
    bindings: { "Shift++": {} },
    steps: [{ press: p("+", "shift"), expect: ["Shift++"] }],
  },

  // ------------------------------------------------------------- modifiers
  {
    id: "mods-each",
    group: "Modifiers",
    title: "Each modifier",
    tags: ["MODS"],
    description: "Shift, Control, Alt and Meta each gate their binding.",
    bindings: { "Shift+a": {}, "Control+a": {}, "Alt+a": {}, "Meta+a": {} },
    steps: [
      { press: p("A", "shift", { code: "KeyA" }), expect: ["Shift+a"] },
      { press: p("a", "ctrl"), expect: ["Control+a"] },
      { press: p("a", "alt"), expect: ["Alt+a"] },
      { press: p("a", "meta"), expect: ["Meta+a"] },
    ],
  },
  {
    id: "mods-multi",
    group: "Modifiers",
    title: "Multiple modifiers",
    tags: ["MODS"],
    description: "Every required modifier must be held.",
    bindings: { "Shift+Control+a": {} },
    steps: [
      { press: p("a", "ctrl"), expect: [] },
      {
        press: p("A", "shift ctrl", { code: "KeyA" }),
        expect: ["Shift+Control+a"],
      },
    ],
  },
  {
    id: "mod",
    group: "Modifiers",
    title: "$mod is platform-aware",
    tags: ["MODS", "PLATFORM"],
    description: "`$mod` is Meta on Apple devices and Control everywhere else.",
    bindings: { "$mod+k": {} },
    steps: [{ press: p("k", "mod"), expect: ["$mod+k"], prevented: false }],
  },
  {
    id: "aliases",
    group: "Modifiers",
    title: "Modifier aliases",
    tags: ["MODS", "ALIAS"],
    description: "`Ctrl`, `Cmd` and `Option` are aliases, case-insensitive.",
    bindings: { "ctrl+1": {}, "Cmd+2": {}, "Option+3": {} },
    steps: [
      { press: p("1", "ctrl"), expect: ["ctrl+1"] },
      { press: p("2", "meta"), expect: ["Cmd+2"] },
      { press: p("3", "alt"), expect: ["Option+3"] },
    ],
  },
  {
    id: "extra-mod",
    group: "Modifiers",
    title: "Extra modifier blocks a match",
    tags: ["MODS", "STRICT"],
    description: "`a` must not fire on Shift+a or Control+a.",
    bindings: { a: {} },
    steps: [
      { press: p("A", "shift", { code: "KeyA" }), expect: [] },
      { press: p("a", "ctrl"), expect: [] },
      { press: p("a"), expect: ["a"] },
    ],
  },
  {
    id: "shifted-symbol",
    group: "Modifiers",
    title: "Shifted symbols need Shift",
    tags: ["MODS", "STRICT"],
    description: "Typing `?` holds Shift, so a bare `?` never fires; write `Shift+?`.",
    bindings: { "?": {}, "Shift+?": {} },
    steps: [{ press: p("?", "shift", { code: "Slash" }), expect: ["Shift+?"] }],
  },
  {
    id: "modifier-key",
    group: "Modifiers",
    title: "Modifier as the key",
    tags: ["MODS"],
    description: "Binding `Shift` alone fires on the Shift keydown, though Shift is held.",
    bindings: { Shift: {} },
    steps: [{ press: p("Shift", "shift"), expect: ["Shift"] }],
  },
  {
    id: "optional",
    group: "Modifiers",
    title: "Optional modifiers",
    tags: ["MODS", "OPTIONAL"],
    description: "`Control+[Shift]+a` needs Control; Shift may or may not be held.",
    bindings: { "Control+[Shift]+a": {} },
    steps: [
      { press: p("a", "ctrl"), expect: ["Control+[Shift]+a"] },
      {
        press: p("A", "ctrl shift", { code: "KeyA" }),
        expect: ["Control+[Shift]+a"],
      },
      { press: p("A", "shift", { code: "KeyA" }), expect: [] },
    ],
  },

  // ------------------------------------------------------------- altgraph
  {
    id: "altgraph",
    group: "AltGraph",
    title: "AltGraph+key",
    tags: ["ALTGR"],
    description: "Fires with AltGraph held, and not without it.",
    bindings: { "AltGraph+KeyE": {} },
    steps: [
      {
        press: p("€", "altGraph alt", { code: "KeyE" }),
        expect: ["AltGraph+KeyE"],
      },
      { press: p("e"), expect: [] },
    ],
  },
  {
    id: "altgraph-alias",
    group: "AltGraph",
    title: "AltGraph satisfies Alt",
    tags: ["ALTGR", "ALIAS"],
    description: "AltGraph counts as Alt (and Control on Windows).",
    bindings: { "Alt+KeyE": {} },
    steps: [{ press: p("€", "altGraph", { code: "KeyE" }), expect: ["Alt+KeyE"] }],
  },
  {
    id: "altgraph-plain",
    group: "AltGraph",
    title: "AltGraph blocks plain bindings",
    tags: ["ALTGR", "STRICT"],
    description: "Typing € with AltGr must not trigger a bare `KeyE` binding.",
    bindings: { KeyE: {} },
    steps: [{ press: p("€", "altGraph alt", { code: "KeyE" }), expect: [] }],
  },

  // ------------------------------------------------------------- sequences
  {
    id: "seq",
    group: "Sequences",
    title: "Full sequence",
    tags: ["SEQ"],
    description: "`y e e t` fires only after the last press.",
    bindings: { "y e e t": {} },
    steps: typed("yeet", ["y e e t"]),
  },
  {
    id: "seq-partial",
    group: "Sequences",
    title: "Partial sequence",
    tags: ["SEQ"],
    description: "Stopping early fires nothing.",
    bindings: { "y e e t": {} },
    steps: typed("yee"),
  },
  {
    id: "seq-restart",
    group: "Sequences",
    title: "Broken press restarts",
    tags: ["SEQ", "NEW"],
    description: "In `g g i`, the second g breaks then restarts the sequence.",
    bindings: { "g i": {} },
    steps: typed("ggi", ["g i"]),
  },
  {
    id: "seq-held-mod",
    group: "Sequences",
    title: "Held modifier keeps a sequence",
    tags: ["SEQ", "MODS"],
    description: "Pressing Shift between g and Shift+i must not reset the sequence.",
    bindings: { "g Shift+i": {} },
    steps: [
      { press: p("g"), expect: [] },
      { press: p("Shift", "shift"), expect: [] },
      { press: p("I", "shift", { code: "KeyI" }), expect: ["g Shift+i"] },
    ],
  },
  {
    id: "seq-timeout",
    group: "Sequences",
    title: "Sequence timeout",
    tags: ["SEQ", "TIMEOUT"],
    description: "With `timeout: 100`, a 150 ms gap resets; a quick retry fires.",
    bindings: { "g i": {} },
    options: { timeout: 100 },
    steps: [
      { press: p("g"), expect: [] },
      { press: p("i", "", { wait: 150 }), expect: [] },
      { press: p("g"), expect: [] },
      { press: p("i"), expect: ["g i"] },
    ],
  },
  {
    id: "seq-conflict",
    group: "Sequences",
    title: "Conflict waits for longer sequence",
    tags: ["SEQ", "CONFLICT"],
    description: "With `g i` pending, the completed `i` binding yields.",
    bindings: { "g i": {}, i: {} },
    steps: [
      { press: p("g"), expect: [] },
      { press: p("i"), expect: ["g i"] },
      { press: p("i"), expect: ["i"] },
    ],
  },
  {
    id: "seq-whitespace",
    group: "Sequences",
    title: "Whitespace is tolerated",
    tags: ["SEQ", "PARSE", "NEW"],
    description: "Leading, trailing and repeated spaces are ignored.",
    bindings: { "  g   i ": {} },
    steps: typed("gi", ["  g   i "]),
  },
  {
    id: "konami",
    group: "Sequences",
    title: "Konami code",
    tags: ["SEQ"],
    description: "A 10-press sequence with arrow keys.",
    bindings: {
      "ArrowUp ArrowUp ArrowDown ArrowDown ArrowLeft ArrowRight ArrowLeft ArrowRight b a": {},
    },
    steps: [
      ..."ArrowUp ArrowUp ArrowDown ArrowDown ArrowLeft ArrowRight ArrowLeft ArrowRight b"
        .split(" ")
        .map((key) => ({ press: p(key), expect: [] })),
      {
        press: p("a"),
        expect: [
          "ArrowUp ArrowUp ArrowDown ArrowDown ArrowLeft ArrowRight ArrowLeft ArrowRight b a",
        ],
      },
    ],
  },

  // ------------------------------------------------------------- config
  {
    id: "prevent",
    group: "Binding options",
    title: "preventDefault per binding",
    tags: ["CONFIG", "NEW"],
    description: "Only the configured binding prevents the default action.",
    bindings: { "$mod+s": { preventDefault: true }, "$mod+o": {} },
    steps: [
      { press: p("s", "mod"), expect: ["$mod+s"], prevented: true },
      { press: p("o", "mod"), expect: ["$mod+o"], prevented: false },
    ],
  },
  {
    id: "prevent-global",
    group: "Binding options",
    title: "Global preventDefault, overridden",
    tags: ["CONFIG", "NEW"],
    description: "A global default applies unless a binding opts out.",
    bindings: { a: {}, b: { preventDefault: false } },
    options: { preventDefault: true },
    steps: [
      { press: p("a"), expect: ["a"], prevented: true },
      { press: p("b"), expect: ["b"], prevented: false },
      { press: p("c"), expect: [], prevented: false },
    ],
  },
  {
    id: "stop",
    group: "Binding options",
    title: "stopPropagation",
    tags: ["CONFIG", "NEW"],
    description: "The event must not bubble past the host when configured.",
    bindings: { Escape: { stopPropagation: true }, Enter: {} },
    steps: [
      { press: p("Escape"), expect: ["Escape"], stopped: true },
      { press: p("Enter"), expect: ["Enter"], stopped: false },
    ],
  },
  {
    id: "repeat-default",
    group: "Binding options",
    title: "Auto-repeat ignored by default",
    tags: ["CONFIG", "REPEAT"],
    description: "Holding a key fires once.",
    bindings: { a: {} },
    steps: [
      { press: p("a"), expect: ["a"] },
      { press: p("a", "", { repeat: true }), expect: [] },
    ],
  },
  {
    id: "repeat",
    group: "Binding options",
    title: "repeat: true",
    tags: ["CONFIG", "REPEAT", "NEW"],
    description: "Opt-in bindings fire on every auto-repeat.",
    bindings: { ArrowDown: { repeat: true } },
    steps: [
      { press: p("ArrowDown"), expect: ["ArrowDown"] },
      { press: p("ArrowDown", "", { repeat: true }), expect: ["ArrowDown"] },
      { press: p("ArrowDown", "", { repeat: true }), expect: ["ArrowDown"] },
    ],
  },
  {
    id: "when",
    group: "Binding options",
    title: "when falls through",
    tags: ["CONFIG", "NEW"],
    description: "A binding whose `when` is false lets the next match fire.",
    bindings: { Enter: { when: () => false }, enter: {} },
    steps: [{ press: p("Enter"), expect: ["enter"] }],
  },
  {
    id: "once",
    group: "Binding options",
    title: "once",
    tags: ["CONFIG", "NEW"],
    description: "The binding removes itself after firing.",
    bindings: { "Shift+?": { once: true } },
    steps: [
      { press: p("?", "shift", { code: "Slash" }), expect: ["Shift+?"] },
      { press: p("?", "shift", { code: "Slash" }), expect: [] },
    ],
  },
  {
    id: "keyup",
    group: "Binding options",
    title: "Listen on keyup",
    tags: ["EVENT"],
    description: 'With `event: "keyup"`, keydown is ignored.',
    bindings: { a: {} },
    options: { event: "keyup" },
    steps: [
      { press: p("a"), expect: [] },
      { press: p("a", "", { type: "keyup" }), expect: ["a"] },
    ],
  },

  // ------------------------------------------------------------- layouts
  {
    id: "layout-non-latin",
    group: "Layouts",
    title: "Non-Latin layouts",
    tags: ["LAYOUT", "NEW"],
    description: "On a Russian layout, Ctrl+ы (KeyS) fires `Control+s`.",
    bindings: { "Control+s": {} },
    steps: [{ press: p("ы", "ctrl", { code: "KeyS" }), expect: ["Control+s"] }],
  },
  {
    id: "layout-option-chars",
    group: "Layouts",
    title: "Option characters",
    tags: ["LAYOUT", "NEW"],
    description: "Option+A types å on macOS but still fires `Alt+a`.",
    bindings: { "Alt+a": {} },
    steps: [{ press: p("å", "alt", { code: "KeyA" }), expect: ["Alt+a"] }],
  },
  {
    id: "layout-azerty",
    group: "Layouts",
    title: "Latin layouts follow the typed letter",
    tags: ["LAYOUT"],
    description: "On AZERTY, the KeyQ key types a and fires `a`, not `q`.",
    bindings: { q: {}, a: {} },
    steps: [{ press: p("a", "", { code: "KeyQ" }), expect: ["a"] }],
  },

  // ------------------------------------------------------------- ignore
  {
    id: "ignore-fields",
    group: "Ignore",
    title: "Editable fields are ignored",
    tags: ["IGNORE"],
    description: "Typing inside inputs, textareas, selects or contenteditable fires nothing.",
    bindings: { a: {} },
    steps: [
      { press: p("a", "", { on: "input" }), expect: [] },
      { press: p("a", "", { on: "textarea" }), expect: [] },
      { press: p("a", "", { on: "select" }), expect: [] },
      { press: p("a", "", { on: "contenteditable" }), expect: [] },
      { press: p("a"), expect: ["a"] },
    ],
  },
  {
    id: "ignore-shortcuts-in-fields",
    group: "Ignore",
    title: "Shortcuts still work in fields",
    tags: ["IGNORE", "NEW"],
    description: "`$mod+s` and `Escape` fire from a text field; `$mod+a` stays select-all.",
    bindings: { "$mod+s": {}, Escape: {}, "$mod+a": {} },
    steps: [
      { press: p("s", "mod", { on: "input" }), expect: ["$mod+s"] },
      { press: p("Escape", "", { on: "textarea" }), expect: ["Escape"] },
      { press: p("a", "mod", { on: "input" }), expect: [] },
    ],
  },
  {
    id: "ignore-custom",
    group: "Ignore",
    title: "Custom ignore",
    tags: ["IGNORE"],
    description: "`ignore: () => false` allows events from inputs.",
    bindings: { a: {} },
    options: { ignore: () => false },
    steps: [{ press: p("a", "", { on: "input" }), expect: ["a"] }],
  },
  {
    id: "ime",
    group: "Ignore",
    title: "IME composition",
    tags: ["IGNORE", "IME"],
    description: "Keys typed while composing 你好 (n-i-h-a-o) must not fire.",
    bindings: { n: {}, a: {}, Enter: {} },
    steps: [
      ..."niha".split("").map((key) => ({ press: p(key, "", { composing: true }), expect: [] })),
      { press: p("Enter", "", { composing: true }), expect: [] },
      { press: p("n"), expect: ["n"] },
    ],
  },

  // ------------------------------------------------------------- errors
  {
    id: "error-modifier",
    group: "Errors",
    title: "Unknown modifier throws",
    tags: ["PARSE", "NEW"],
    description: "Bad bindings fail loudly instead of never matching.",
    bindings: { "Hyper+a": {} },
    steps: [],
    throws: /unknown modifier "Hyper"/,
  },
  {
    id: "error-empty",
    group: "Errors",
    title: "Empty key throws",
    tags: ["PARSE", "NEW"],
    description: "`Shift+` has no key.",
    bindings: { "Shift+": {} },
    steps: [],
    throws: /empty key/,
  },
];
