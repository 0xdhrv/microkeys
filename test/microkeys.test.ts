import { afterEach, describe, expect, onTestFinished, test, vi } from "vite-plus/test";
import {
  IS_APPLE,
  createKeybindingsHandler,
  formatKeybinding,
  keybindingFromEvent,
  microkeys,
  recordKeybinding,
  parseKeybinding,
  type KeybindingOptions,
  type KeybindingsMap,
} from "../src/index";

const MOD = IS_APPLE ? "Meta" : "Control";

function $el(tagName: string, attrs: Record<string, string> = {}) {
  const element = document.createElement(tagName);
  for (const [key, value] of Object.entries(attrs)) {
    element.setAttribute(key, value);
  }
  document.body.appendChild(element);
  onTestFinished(() => element.remove());
  return element;
}

function bind(
  map: KeybindingsMap,
  options?: KeybindingOptions,
  target: Window | HTMLElement = window,
) {
  onTestFinished(microkeys(target, map, options));
}

function code(key: string): string {
  if (/^[a-z]$/i.test(key)) return `Key${key.toUpperCase()}`;
  if (/^[0-9]$/.test(key)) return `Digit${key}`;
  return key;
}

function press(
  key: string,
  init: KeyboardEventInit = {},
  target: EventTarget = window,
  type = "keydown",
) {
  const event = new KeyboardEvent(type, {
    key,
    code: code(key),
    bubbles: true,
    cancelable: true,
    ...init,
  });
  target.dispatchEvent(event);
  return event;
}

function type(keys: string, init?: KeyboardEventInit) {
  for (const key of keys) press(key, init);
}

afterEach(() => {
  vi.useRealTimers();
});

describe("single press", () => {
  test("KeyboardEvent.key", () => {
    const cb = vi.fn();
    bind({ a: cb });
    press("a");
    expect(cb).toHaveBeenCalledOnce();
  });

  test("KeyboardEvent.code", () => {
    const cb = vi.fn();
    bind({ KeyA: cb });
    press("a");
    expect(cb).toHaveBeenCalledOnce();
  });

  test("key is case-insensitive", () => {
    const cb = vi.fn();
    bind({ escape: cb });
    press("Escape");
    expect(cb).toHaveBeenCalledOnce();
  });

  test("regex key", () => {
    const cb = vi.fn();
    bind({ "(F[1-9])": cb });
    press("F1");
    press("F10");
    expect(cb).toHaveBeenCalledOnce();
  });

  test("handler receives event and binding", () => {
    const cb = vi.fn();
    bind({ "Shift+a": cb });
    const event = press("A", { shiftKey: true, code: "KeyA" });
    expect(cb).toHaveBeenCalledWith(event, { binding: "Shift+a" });
  });

  test("ignores non-keyboard events", () => {
    const cb = vi.fn();
    bind({ a: cb });
    window.dispatchEvent(new Event("keydown"));
    expect(cb).not.toHaveBeenCalled();
  });
});

describe("sequences", () => {
  test("full sequence", () => {
    const cb = vi.fn();
    bind({ "y e e t": cb });
    type("yeet");
    expect(cb).toHaveBeenCalledOnce();
  });

  test("partial sequence", () => {
    const cb = vi.fn();
    bind({ "y e e t": cb });
    type("yee");
    expect(cb).not.toHaveBeenCalled();
  });

  test("extra whitespace is tolerated", () => {
    const cb = vi.fn();
    bind({ "  g   i ": cb });
    type("gi");
    expect(cb).toHaveBeenCalledOnce();
  });

  test("restarts when a broken press begins the sequence", () => {
    const cb = vi.fn();
    bind({ "g i": cb });
    type("ggi");
    expect(cb).toHaveBeenCalledOnce();
  });

  test("holding a modifier between presses keeps the sequence", () => {
    const cb = vi.fn();
    bind({ "g Shift+i": cb });
    press("g");
    press("Shift", { shiftKey: true, code: "ShiftLeft" });
    press("I", { shiftKey: true, code: "KeyI" });
    expect(cb).toHaveBeenCalledOnce();
  });

  test("times out", () => {
    vi.useFakeTimers();
    const cb = vi.fn();
    bind({ "g i": cb }, { timeout: 500 });
    press("g");
    vi.advanceTimersByTime(600);
    press("i");
    expect(cb).not.toHaveBeenCalled();
    press("g");
    vi.advanceTimersByTime(400);
    press("i");
    expect(cb).toHaveBeenCalledOnce();
  });

  test("conflict: shorter binding waits for longer sequence", () => {
    const short = vi.fn();
    const long = vi.fn();
    const onConflict = vi.fn();
    bind({ "g i": long, i: short }, { onConflict });
    press("g");
    press("i");
    expect(long).toHaveBeenCalledOnce();
    expect(short).not.toHaveBeenCalled();
  });

  test("conflict callback", () => {
    const onConflict = vi.fn();
    bind({ "a b": () => {}, a: () => {} }, { onConflict });
    press("a");
    expect(onConflict).toHaveBeenCalledWith("a", ["a b"]);
  });

  test("reset() clears pending sequences", () => {
    const cb = vi.fn();
    const listener = createKeybindingsHandler({ "g i": cb });
    window.addEventListener("keydown", listener);
    onTestFinished(() => window.removeEventListener("keydown", listener));
    press("g");
    listener.reset();
    press("i");
    expect(cb).not.toHaveBeenCalled();
  });
});

test("keyup event", () => {
  const cb = vi.fn();
  bind({ a: cb }, { event: "keyup" });
  press("a");
  expect(cb).not.toHaveBeenCalled();
  press("a", {}, window, "keyup");
  expect(cb).toHaveBeenCalledOnce();
});

describe("modifiers", () => {
  test.each([
    ["Shift", { shiftKey: true }],
    ["Meta", { metaKey: true }],
    ["Alt", { altKey: true }],
    ["Control", { ctrlKey: true }],
  ] as const)("%s", (mod, init) => {
    const cb = vi.fn();
    bind({ [`${mod}+a`]: cb });
    press("a", init);
    expect(cb).toHaveBeenCalledOnce();
  });

  test.each([
    ["Ctrl", { ctrlKey: true }],
    ["ctrl", { ctrlKey: true }],
    ["Cmd", { metaKey: true }],
    ["Command", { metaKey: true }],
    ["Option", { altKey: true }],
    ["Opt", { altKey: true }],
  ] as const)("alias %s", (mod, init) => {
    const cb = vi.fn();
    bind({ [`${mod}+a`]: cb });
    press("a", init);
    expect(cb).toHaveBeenCalledOnce();
  });

  test("$mod", () => {
    const cb = vi.fn();
    bind({ "$mod+a": cb });
    press("a", IS_APPLE ? { metaKey: true } : { ctrlKey: true });
    expect(cb).toHaveBeenCalledOnce();
  });

  test("multiple modifiers", () => {
    const cb = vi.fn();
    bind({ "Shift+Control+a": cb });
    press("a", { shiftKey: true, ctrlKey: true });
    expect(cb).toHaveBeenCalledOnce();
  });

  test("extra modifier prevents match", () => {
    const cb = vi.fn();
    bind({ a: cb });
    press("a", { shiftKey: true });
    expect(cb).not.toHaveBeenCalled();
  });

  test("missing modifier prevents match", () => {
    const cb = vi.fn();
    bind({ "Shift+a": cb });
    press("a");
    expect(cb).not.toHaveBeenCalled();
  });

  test("modifier as key", () => {
    const cb = vi.fn();
    bind({ Shift: cb });
    press("Shift", { shiftKey: true, code: "ShiftLeft" });
    expect(cb).toHaveBeenCalledOnce();
  });

  test("plus key", () => {
    const cb = vi.fn();
    bind({ "Shift++": cb });
    press("+", { shiftKey: true, code: "Equal" });
    expect(cb).toHaveBeenCalledOnce();
  });
});

describe("optional modifiers", () => {
  test("fires without optional modifier", () => {
    const cb = vi.fn();
    bind({ "[Shift]+a": cb });
    press("a");
    expect(cb).toHaveBeenCalledOnce();
  });

  test("fires with optional modifier", () => {
    const cb = vi.fn();
    bind({ "[Shift]+a": cb });
    press("a", { shiftKey: true });
    expect(cb).toHaveBeenCalledOnce();
  });

  test("optional $mod", () => {
    const cb = vi.fn();
    bind({ "[$mod]+a": cb });
    press("a");
    press("a", { [`${MOD === "Meta" ? "meta" : "ctrl"}Key`]: true });
    expect(cb).toHaveBeenCalledTimes(2);
  });

  test("required alongside optional", () => {
    const cb = vi.fn();
    bind({ "Control+[Shift]+a": cb });
    press("a", { ctrlKey: true });
    press("a", { ctrlKey: true, shiftKey: true });
    press("a", { shiftKey: true });
    expect(cb).toHaveBeenCalledTimes(2);
  });
});

describe("AltGraph", () => {
  // happy-dom may not implement `modifierAltGraph`, so stub the state.
  function altGr(key: string, code: string, init: KeyboardEventInit = {}) {
    const event = new KeyboardEvent("keydown", {
      key,
      code,
      bubbles: true,
      ...init,
    });
    const native = event.getModifierState.bind(event);
    event.getModifierState = (m: string) => m === "AltGraph" || native(m);
    window.dispatchEvent(event);
  }

  test("AltGraph+key fires with AltGraph and Alt", () => {
    const cb = vi.fn();
    bind({ "AltGraph+KeyE": cb });
    altGr("€", "KeyE", { altKey: true });
    expect(cb).toHaveBeenCalledOnce();
  });

  test("Alt+key fires when only AltGraph is active (alias)", () => {
    const cb = vi.fn();
    bind({ "Alt+KeyE": cb });
    altGr("€", "KeyE");
    expect(cb).toHaveBeenCalledOnce();
  });

  test("AltGraph+key does not fire without AltGraph", () => {
    const cb = vi.fn();
    bind({ "AltGraph+KeyE": cb });
    press("e");
    expect(cb).not.toHaveBeenCalled();
  });

  test("plain bindings don't fire with AltGraph", () => {
    const cb = vi.fn();
    bind({ KeyE: cb });
    altGr("€", "KeyE", { altKey: true });
    expect(cb).not.toHaveBeenCalled();
  });
});

describe("keyboard layouts", () => {
  test("non-Latin layout matches the physical letter", () => {
    const cb = vi.fn();
    bind({ "Control+s": cb });
    press("ы", { code: "KeyS", ctrlKey: true });
    expect(cb).toHaveBeenCalledOnce();
  });

  test("Option-produced characters match the physical letter", () => {
    const cb = vi.fn();
    bind({ "Alt+a": cb, "Alt+e": cb });
    press("å", { code: "KeyA", altKey: true });
    press("Dead", { code: "KeyE", altKey: true });
    expect(cb).toHaveBeenCalledTimes(2);
  });

  test("Latin layouts match the typed letter, not the physical key", () => {
    const q = vi.fn();
    const a = vi.fn();
    bind({ q, a });
    press("a", { code: "KeyQ" }); // AZERTY
    expect(q).not.toHaveBeenCalled();
    expect(a).toHaveBeenCalledOnce();
  });
});

describe("exclusive", () => {
  test("pauses other subscriptions until it unsubscribes", () => {
    const page = vi.fn();
    const dialog = vi.fn();
    bind({ Escape: page, a: page });
    const off = microkeys(window, { Escape: dialog }, { exclusive: true });
    press("Escape");
    press("a");
    expect(dialog).toHaveBeenCalledOnce();
    expect(page).not.toHaveBeenCalled();
    off();
    press("Escape");
    expect(page).toHaveBeenCalledOnce();
  });

  test("closing on a key doesn't leak that key to the page", () => {
    const page = vi.fn();
    bind({ Escape: page });
    const el = $el("div");
    const off = microkeys(el, { Escape: () => off() }, { exclusive: true });
    press("Escape", {}, el);
    expect(page).not.toHaveBeenCalled();
  });

  test("the most recent exclusive subscription wins", () => {
    const first = vi.fn();
    const second = vi.fn();
    bind({ a: first }, { exclusive: true });
    const off = microkeys(window, { a: second }, { exclusive: true });
    press("a");
    off();
    press("a");
    expect(second).toHaveBeenCalledOnce();
    expect(first).toHaveBeenCalledOnce();
  });
});

describe("recordKeybinding", () => {
  const modInit = { [IS_APPLE ? "metaKey" : "ctrlKey"]: true };

  test("resolves with the pressed shortcut, skipping lone modifiers", async () => {
    const recording = recordKeybinding();
    press("Shift", { shiftKey: true, code: "ShiftLeft" });
    const event = press("K", { ...modInit, shiftKey: true, code: "KeyK" });
    await expect(recording).resolves.toBe("$mod+Shift+k");
    expect(event.defaultPrevented).toBe(true);
  });

  test("named keys and layouts", () => {
    expect(keybindingFromEvent(new KeyboardEvent("keydown", { key: " ", code: "Space" }))).toBe(
      "Space",
    );
    expect(keybindingFromEvent(new KeyboardEvent("keydown", { key: "ы", code: "KeyS" }))).toBe("s");
    expect(
      keybindingFromEvent(new KeyboardEvent("keydown", { key: "ArrowUp", altKey: true })),
    ).toBe("Alt+ArrowUp");
    expect(
      keybindingFromEvent(new KeyboardEvent("keydown", { key: "k", ...modInit }), { mod: false }),
    ).toBe(`${MOD}+k`);
  });

  test("recorded bindings match the event that produced them", () => {
    const init = { key: "?", code: "Slash", shiftKey: true, ...modInit };
    const cb = vi.fn();
    bind({ [keybindingFromEvent(new KeyboardEvent("keydown", init))]: cb });
    press("?", init);
    expect(cb).toHaveBeenCalledOnce();
  });

  test("abort rejects", async () => {
    const controller = new AbortController();
    const recording = recordKeybinding(window, { signal: controller.signal });
    controller.abort(new Error("cancelled"));
    await expect(recording).rejects.toThrow("cancelled");
  });
});

describe("IME composition", () => {
  test("ignores keydown during composition", () => {
    const cb = vi.fn();
    bind({ n: cb, a: cb, Enter: cb });
    for (const key of ["n", "i", "h", "a", "o", "Enter"]) {
      press(key, { isComposing: true });
    }
    expect(cb).not.toHaveBeenCalled();
    press("n");
    expect(cb).toHaveBeenCalledOnce();
  });
});

describe("ignore", () => {
  test.each([
    ["input", {}],
    ["textarea", {}],
    ["select", {}],
    ["div", { contenteditable: "true" }],
  ] as const)("ignores events from %s", (tag, attrs) => {
    const cb = vi.fn();
    bind({ a: cb });
    press("a", {}, $el(tag, attrs));
    expect(cb).not.toHaveBeenCalled();
  });

  test("allows the currentTarget", () => {
    const input = $el("input");
    const cb = vi.fn();
    bind({ a: cb }, {}, input);
    press("a", {}, input);
    expect(cb).toHaveBeenCalledOnce();
  });

  test.each([
    [`${MOD}+s`, "s", { [IS_APPLE ? "metaKey" : "ctrlKey"]: true }],
    ["Escape", "Escape", {}],
    ["F2", "F2", {}],
  ] as const)("%s still fires from a text field", (binding, key, init) => {
    const cb = vi.fn();
    bind({ [binding]: cb });
    press(key, init, $el("input"));
    expect(cb).toHaveBeenCalledOnce();
  });

  test("text editing combos stay with the text field", () => {
    const cb = vi.fn();
    bind({ "$mod+a": cb, "$mod+z": cb });
    const input = $el("textarea");
    const init = { [IS_APPLE ? "metaKey" : "ctrlKey"]: true };
    press("a", init, input);
    press("z", init, input);
    expect(cb).not.toHaveBeenCalled();
  });

  test("non-text inputs don't block letters", () => {
    const cb = vi.fn();
    bind({ a: cb });
    press("a", {}, $el("input", { type: "checkbox" }));
    expect(cb).toHaveBeenCalledOnce();
  });

  test("focused buttons keep Enter and Space", () => {
    const cb = vi.fn();
    bind({ Enter: cb, Space: cb, "$mod+Enter": cb });
    const button = $el("button");
    press("Enter", {}, button);
    press(" ", { code: "Space" }, button);
    expect(cb).not.toHaveBeenCalled();
    press("Enter", { [IS_APPLE ? "metaKey" : "ctrlKey"]: true }, button);
    press("Enter", {}, $el("div"));
    expect(cb).toHaveBeenCalledTimes(2);
  });

  test("menus keep arrow keys", () => {
    const cb = vi.fn();
    bind({ ArrowDown: cb });
    const menu = $el("div", { role: "menu" });
    const item = document.createElement("div");
    menu.appendChild(item);
    press("ArrowDown", {}, item);
    expect(cb).not.toHaveBeenCalled();
    press("ArrowDown", {}, $el("div"));
    expect(cb).toHaveBeenCalledOnce();
  });

  test("custom ignore overrides default", () => {
    const input = $el("input");
    const cb = vi.fn();
    bind({ a: cb }, { ignore: () => false });
    press("a", {}, input);
    expect(cb).toHaveBeenCalledOnce();
  });
});

describe("binding config", () => {
  test("preventDefault / stopPropagation per binding", () => {
    bind({ a: { handler: () => {}, preventDefault: true } });
    expect(press("a").defaultPrevented).toBe(true);
    expect(press("b").defaultPrevented).toBe(false);
  });

  test("global preventDefault with per-binding override", () => {
    bind(
      { a: () => {}, b: { handler: () => {}, preventDefault: false } },
      { preventDefault: true },
    );
    expect(press("a").defaultPrevented).toBe(true);
    expect(press("b").defaultPrevented).toBe(false);
  });

  test("stopPropagation", () => {
    const outer = vi.fn();
    const el = $el("div");
    bind({ a: outer });
    bind({ a: { handler: () => {}, stopPropagation: true } }, {}, el);
    press("a", {}, el);
    expect(outer).not.toHaveBeenCalled();
  });

  test("repeat is ignored by default", () => {
    const cb = vi.fn();
    bind({ a: cb });
    press("a", { repeat: true });
    expect(cb).not.toHaveBeenCalled();
  });

  test("repeat: true", () => {
    const cb = vi.fn();
    bind({ ArrowDown: { handler: cb, repeat: true } });
    press("ArrowDown");
    press("ArrowDown", { repeat: true });
    expect(cb).toHaveBeenCalledTimes(2);
  });

  test("when: falls through to the next binding", () => {
    let editing = false;
    const edit = vi.fn();
    const view = vi.fn();
    const listener = createKeybindingsHandler({
      Enter: { handler: edit, when: () => editing },
      enter: view,
    });
    window.addEventListener("keydown", listener);
    onTestFinished(() => window.removeEventListener("keydown", listener));
    press("Enter");
    editing = true;
    press("Enter");
    expect(view).toHaveBeenCalledOnce();
    expect(edit).toHaveBeenCalledOnce();
  });

  test("once", () => {
    const cb = vi.fn();
    bind({ a: { handler: cb, once: true } });
    press("a");
    press("a");
    expect(cb).toHaveBeenCalledOnce();
  });
});

describe("subscription", () => {
  test("unsubscribe", () => {
    const cb = vi.fn();
    const off = microkeys(window, { a: cb });
    off();
    press("a");
    expect(cb).not.toHaveBeenCalled();
  });

  test("AbortSignal", () => {
    const cb = vi.fn();
    const controller = new AbortController();
    microkeys(window, { a: cb }, { signal: controller.signal });
    press("a");
    controller.abort();
    press("a");
    expect(cb).toHaveBeenCalledOnce();
  });

  test("already-aborted signal never subscribes", () => {
    const cb = vi.fn();
    microkeys(window, { a: cb }, { signal: AbortSignal.abort() });
    press("a");
    expect(cb).not.toHaveBeenCalled();
  });
});

describe("parseKeybinding", () => {
  test("throws on unknown modifier", () => {
    expect(() => parseKeybinding("Hyper+a")).toThrow(SyntaxError);
  });

  test("throws on empty key", () => {
    expect(() => parseKeybinding("")).toThrow(SyntaxError);
  });

  test("throws when created with invalid runtime string", () => {
    const map: Record<string, () => void> = { "Foo+a": () => {} };
    expect(() => createKeybindingsHandler(map)).toThrow(/unknown modifier/);
  });
});

describe("formatKeybinding", () => {
  test("apple", () => {
    expect(formatKeybinding("Meta+Shift+k", { apple: true })).toBe("⇧⌘K");
    expect(formatKeybinding("Control+Alt+Enter", { apple: true })).toBe("⌃⌥↩");
    expect(formatKeybinding("[Shift]+KeyA", { apple: true })).toBe("A");
  });

  test("default", () => {
    expect(formatKeybinding("Meta+Shift+k", { apple: false })).toBe("Win+Shift+K");
    expect(formatKeybinding("Ctrl+Digit1", { apple: false })).toBe("Ctrl+1");
    expect(formatKeybinding("Escape", { apple: false })).toBe("Esc");
  });

  test("sequences and regex keys", () => {
    expect(formatKeybinding("g i", { apple: false })).toBe("G I");
    expect(formatKeybinding("Shift+(F[1-9])", { apple: false })).toBe("Shift+(F[1-9])");
    expect(formatKeybinding("g i", { apple: false, sequenceSeparator: " then " })).toBe("G then I");
  });
});
