import { ALT, ALT_GRAPH, CONTROL, IS_APPLE, META, SHIFT, parseKeybinding } from "./core";

export interface FormatOptions {
  /** Use Apple symbols (⌘⇧⌥⌃). Defaults to the current platform. */
  apple?: boolean;
  /** Separator between modifiers and key. Default `""` on Apple, `"+"` elsewhere. */
  separator?: string;
  /** Separator between presses of a sequence. Default `" "`. */
  sequenceSeparator?: string;
}

// Apple Human Interface Guidelines order: Control, Option, Shift, Command.
const APPLE_ORDER: ReadonlyArray<readonly [number, string]> = [
  [CONTROL, "⌃"],
  [ALT, "⌥"],
  [SHIFT, "⇧"],
  [META, "⌘"],
  [ALT_GRAPH, "⌥"],
];

const DEFAULT_ORDER: ReadonlyArray<readonly [number, string]> = [
  [CONTROL, "Ctrl"],
  [META, "Win"],
  [ALT, "Alt"],
  [ALT_GRAPH, "AltGr"],
  [SHIFT, "Shift"],
];

const APPLE_KEYS: { readonly [key: string]: string } = {
  ENTER: "↩",
  ESCAPE: "⎋",
  BACKSPACE: "⌫",
  DELETE: "⌦",
  TAB: "⇥",
  ARROWUP: "↑",
  ARROWDOWN: "↓",
  ARROWLEFT: "←",
  ARROWRIGHT: "→",
  " ": "Space",
  SPACE: "Space",
};

const DEFAULT_KEYS: { readonly [key: string]: string } = {
  ESCAPE: "Esc",
  ARROWUP: "↑",
  ARROWDOWN: "↓",
  ARROWLEFT: "←",
  ARROWRIGHT: "→",
  " ": "Space",
  SPACE: "Space",
};

function formatKey(key: string, apple: boolean): string {
  const upper = key.toUpperCase();
  const named = (apple ? APPLE_KEYS : DEFAULT_KEYS)[upper];
  if (named) return named;
  // KeyA → A, Digit1 → 1
  const code = /^(?:KEY|DIGIT)(.)$/.exec(upper);
  if (code) return code[1] ?? upper;
  return key.length === 1 ? upper : key;
}

/**
 * Formats a keybinding for display.
 *
 * Required modifiers are shown; optional modifiers are omitted.
 *
 * @example
 * formatKeybinding("$mod+Shift+k") // "⇧⌘K" on macOS, "Ctrl+Shift+K" elsewhere
 * formatKeybinding("g i")          // "G I"
 */
export function formatKeybinding(binding: string, options: FormatOptions = {}): string {
  const apple = options.apple ?? IS_APPLE;
  const separator = options.separator ?? (apple ? "" : "+");
  const order = apple ? APPLE_ORDER : DEFAULT_ORDER;

  return parseKeybinding(binding)
    .map((press) => {
      const parts: string[] = [];
      for (const [bit, label] of order) {
        if (press.required & bit && !parts.includes(label)) parts.push(label);
      }
      parts.push(typeof press.key === "string" ? formatKey(press.raw, apple) : press.raw);
      return parts.join(separator);
    })
    .join(options.sequenceSeparator ?? " ");
}
