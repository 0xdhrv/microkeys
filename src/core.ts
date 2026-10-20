/** Platform string, preferring the modern `userAgentData` API. */
const PLATFORM: string =
  typeof navigator === "object"
    ? ((navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData
        ?.platform ??
      navigator.platform ??
      "")
    : "";

/** `true` on macOS / iOS / iPadOS. */
export const IS_APPLE: boolean = /Mac|iPod|iPhone|iPad|macOS|iOS/i.test(PLATFORM);

const IS_WINDOWS: boolean = /^Win/i.test(PLATFORM);

export const SHIFT = 1;
export const META = 2;
export const ALT = 4;
export const CONTROL = 8;
export const ALT_GRAPH = 16;

/** Modifiers that change the meaning of a press when held unexpectedly. */
const STRICT_MASK = SHIFT | META | ALT | CONTROL;

/**
 * Meaning of `AltGraph`, from MDN:
 * - Windows: Both Alt and Ctrl keys are pressed, or AltGr key is pressed
 * - Mac: ⌥ Option key pressed
 * - Linux: Level 3 Shift key (or Level 5 Shift key) pressed
 */
const ALT_GRAPH_ALIASES = IS_WINDOWS ? ALT | CONTROL : ALT;

/** Lower-cased modifier spelling → bit. */
const MODIFIER_LOOKUP: { readonly [name: string]: number } = {
  shift: SHIFT,
  meta: META,
  cmd: META,
  command: META,
  alt: ALT,
  option: ALT,
  opt: ALT,
  control: CONTROL,
  ctrl: CONTROL,
  altgraph: ALT_GRAPH,
  $mod: IS_APPLE ? META : CONTROL,
};

/** Returns the modifier bit for a name, or `0` if it isn't a modifier. */
export function modifierBit(name: string): number {
  return MODIFIER_LOOKUP[name.toLowerCase()] ?? 0;
}

/**
 * Reads all modifier state from an event into a bitmask.
 *
 * Uses `shiftKey`/`metaKey`/… because Chrome omits `getModifierState` on
 * some F-key events; only `AltGraph` needs it.
 */
export function eventModifiers(event: KeyboardEvent): number {
  let mask =
    (event.shiftKey ? SHIFT : 0) |
    (event.metaKey ? META : 0) |
    (event.altKey ? ALT : 0) |
    (event.ctrlKey ? CONTROL : 0);
  if (event.getModifierState?.("AltGraph")) mask |= ALT_GRAPH | ALT_GRAPH_ALIASES;
  return mask;
}

/**
 * A single parsed press of a keybinding sequence.
 */
export interface KeybindingPress {
  /** Bitmask of modifiers that must be held. */
  readonly required: number;
  /** Bitmask of modifiers that may be held. */
  readonly optional: number;
  /** Upper-cased key/code to compare, or a regex tested against both. */
  readonly key: string | RegExp;
  /** Bit of the key itself when the key is a modifier (e.g. `"Shift"`). */
  readonly keyBit: number;
  /** The key as written in the keybinding string. */
  readonly raw: string;
}

const PRESS_SPLIT = /(?<=\w|\])\+/;
const REGEX_KEY = /^\((.+)\)$/;
const OPTIONAL_MOD = /^\[(.*)\]$/;

/**
 * Parses a keybinding string into presses.
 *
 * ```
 * <sequence> = <press> <press> ...         (whitespace-separated)
 * <press>    = <key> | <mods>+<key>
 * <mod>      = <modifier> (required) | [<modifier>] (optional)
 * <key>      = KeyboardEvent.key | KeyboardEvent.code   (case-insensitive)
 * <key>      = (<regex>) → /^(?:<regex>)$/i
 * ```
 *
 * @throws {SyntaxError} on unknown modifiers or empty keys.
 */
export function parseKeybinding(input: string): KeybindingPress[] {
  const presses = input.trim().split(/\s+/);
  return presses.map((press) => {
    const parts = press.split(PRESS_SPLIT);
    const last = parts.pop();
    if (!last) throw new SyntaxError(`microkeys: empty key in "${input}"`);

    let required = 0;
    let optional = 0;
    for (const part of parts) {
      const opt = OPTIONAL_MOD.exec(part);
      const name = opt ? (opt[1] ?? "") : part;
      const bit = modifierBit(name);
      if (!bit) {
        throw new SyntaxError(`microkeys: unknown modifier "${name}" in "${input}"`);
      }
      if (opt) optional |= bit;
      else required |= bit;
    }

    const regex = REGEX_KEY.exec(last);
    const key = regex ? new RegExp(`^(?:${regex[1]})$`, "i") : last.toUpperCase();
    return {
      required,
      optional,
      key,
      keyBit: regex ? 0 : modifierBit(last),
      raw: last,
    };
  });
}

/**
 * Pre-normalized event data, computed once per event and shared by every
 * binding so matching N bindings costs N integer/string compares.
 */
export interface EventInfo {
  readonly key: string;
  readonly code: string;
  readonly upperKey: string;
  readonly upperCode: string;
  /** Latin letter/digit of the physical key when `key` isn't ASCII, else `""`. */
  readonly fallback: string;
  readonly mods: number;
}

/**
 * Autocomplete selection can fire a plain `Event` named "keydown"; only
 * handle real keyboard events.
 */
export function isKeyboardEvent(event: Event): event is KeyboardEvent {
  return typeof (event as Partial<KeyboardEvent>).key === "string";
}

const LAYOUT_CODE = /^(?:Key([A-Z])|Digit(\d))$/;

/**
 * On non-Latin layouts (Russian `ф`) and with Option on macOS (`å`, dead
 * keys), `key` is not the letter a shortcut is written with. Fall back to
 * the letter or digit printed on the physical key.
 */
function layoutFallback(key: string, code: string): string {
  if (key !== "Dead" && (key.length !== 1 || key.charCodeAt(0) < 128)) return "";
  const match = LAYOUT_CODE.exec(code);
  return match ? (match[1] ?? match[2] ?? "") : "";
}

export function eventInfo(event: KeyboardEvent): EventInfo {
  const key = event.key;
  const code = event.code ?? "";
  return {
    key,
    code,
    upperKey: key.toUpperCase(),
    upperCode: code.toUpperCase(),
    fallback: layoutFallback(key, code),
    mods: eventModifiers(event),
  };
}

/**
 * Tests if a normalized event matches a single press.
 */
export function matchPress(info: EventInfo, press: KeybindingPress): boolean {
  const { key, required, optional, keyBit } = press;

  let byKey: boolean;
  if (typeof key === "string") {
    byKey = key === info.upperKey;
    if (!byKey && key !== info.upperCode && key !== info.fallback) return false;
  } else {
    byKey = key.test(info.key);
    if (!byKey && !key.test(info.code) && !(info.fallback && key.test(info.fallback))) {
      return false;
    }
  }

  if ((info.mods & required) !== required) return false;

  // Windows reports AltGr as Control+Alt. A character typed with it (`@` on
  // a German layout) is text, not a `Control+Alt+KeyQ` shortcut.
  if (
    IS_WINDOWS &&
    !byKey &&
    info.mods & ALT_GRAPH &&
    !((required | optional) & ALT_GRAPH) &&
    info.key.length === 1
  ) {
    return false;
  }

  // Unexpected strict modifiers change the meaning of the press.
  let allowed = required | optional | keyBit;
  if (required & ALT_GRAPH) allowed |= ALT_GRAPH_ALIASES;
  return (info.mods & STRICT_MASK & ~allowed) === 0;
}

export function matchKeybindingPress(event: KeyboardEvent, press: KeybindingPress): boolean {
  return matchPress(eventInfo(event), press);
}
