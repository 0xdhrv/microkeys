import { IS_APPLE, eventInfo, modifierBit } from "./core";
import type { KeybindingTarget } from "./types";

export interface KeybindingFromEventOptions {
  /** Write the platform's primary modifier (⌘ / Ctrl) as `$mod`. Default `true`. */
  mod?: boolean;
}

export interface RecordKeybindingOptions extends KeybindingFromEventOptions {
  /** Stops recording. The promise rejects with the signal's reason. */
  signal?: AbortSignal;
}

function keyName(event: KeyboardEvent): string {
  const { key, fallback } = eventInfo(event);
  if (key === " ") return "Space";
  if (fallback) return fallback.toLowerCase();
  if (key === "Unidentified") return event.code;
  return key.length === 1 ? key.toLowerCase() : key;
}

/**
 * Converts a keyboard event into a keybinding string that matches it, e.g.
 * `"$mod+Shift+k"`.
 */
export function keybindingFromEvent(
  event: KeyboardEvent,
  options: KeybindingFromEventOptions = {},
): string {
  const mod = options.mod ?? true;
  const parts: string[] = [];
  if (mod && (IS_APPLE ? event.metaKey : event.ctrlKey)) parts.push("$mod");
  if (event.ctrlKey && !(mod && !IS_APPLE)) parts.push("Control");
  if (event.altKey) parts.push("Alt");
  else if (!event.ctrlKey && event.getModifierState?.("AltGraph")) parts.push("AltGraph");
  if (event.shiftKey) parts.push("Shift");
  if (event.metaKey && !(mod && IS_APPLE)) parts.push("Meta");
  parts.push(keyName(event));
  return parts.join("+");
}

/**
 * Waits for the user to press a shortcut and resolves with its keybinding
 * string. Lone modifier presses and IME composition are skipped. The
 * recorded press is `preventDefault`ed and stopped from propagating.
 *
 * @example
 * ```ts
 * const binding = await recordKeybinding(); // "$mod+Shift+k"
 * microkeys(window, { [binding]: run });
 * ```
 */
export function recordKeybinding(
  target: KeybindingTarget = window,
  options: RecordKeybindingOptions = {},
): Promise<string> {
  const { signal } = options;
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    const cleanup = () => {
      target.removeEventListener("keydown", onKeyDown, true);
      signal?.removeEventListener("abort", onAbort);
    };
    const onAbort = () => {
      cleanup();
      reject(signal?.reason);
    };
    function onKeyDown(event: Event): void {
      if (typeof (event as Partial<KeyboardEvent>).key !== "string") return;
      const keyboardEvent = event as KeyboardEvent;
      if (keyboardEvent.isComposing || modifierBit(keyboardEvent.key)) return;
      keyboardEvent.preventDefault();
      keyboardEvent.stopPropagation();
      cleanup();
      resolve(keybindingFromEvent(keyboardEvent, options));
    }
    target.addEventListener("keydown", onKeyDown, true);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
