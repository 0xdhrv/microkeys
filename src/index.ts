import { eventInfo, modifierBit, matchPress, parseKeybinding, type KeybindingPress } from "./core";
import type {
  KeybindingConfig,
  KeybindingHandlerOptions,
  KeybindingOptions,
  KeybindingTarget,
  KeybindingsMap,
  KeybindingValue,
  Keybindings,
} from "./types";

export { IS_APPLE, eventModifiers, matchKeybindingPress, parseKeybinding } from "./core";
export type { KeybindingPress } from "./core";
export { formatKeybinding, type FormatOptions } from "./format";
export {
  keybindingFromEvent,
  recordKeybinding,
  type KeybindingFromEventOptions,
  type RecordKeybindingOptions,
} from "./record";
export type * from "./types";

const DEFAULT_TIMEOUT = 1000;
/** Expands each word of `list` into `template` (`$&` is the word). */
const expand = (list: string, template: string, separator = ","): string =>
  list.replace(/\w+/g, template).replaceAll(" ", separator);
const EDITABLE = `input${expand("button submit reset checkbox radio range color file image", ":not([type=$&])", "")},select,textarea,[contenteditable]:not([contenteditable=false])`;
const PRESSABLE = `button,a[href],summary,input:not([type=text]),${expand("button link checkbox switch menuitem option tab", "[role=$&]")}`;
const ARROW_WIDGET = `input[type=range],input[type=radio],${expand("menu menubar listbox tree treegrid grid radiogroup tablist toolbar slider spinbutton", "[role=$&]")}`;
/** Keys that leave a text field alone, so they stay shortcuts while typing. */
const NON_TEXT_KEY = /^(?:Escape|F\d{1,2})$/;
/** `$mod` combos the browser uses to edit text: select all, clipboard, undo. */
const TEXT_EDIT_COMBO = /^(?:[acvxyz]|Arrow\w+|Backspace|Delete|Home|End)$/i;

/**
 * Decides which events the browser or a focused control should keep.
 * Events whose target is the listener's own target are never ignored.
 *
 * - During IME composition: everything.
 * - In text fields: typing. `$mod`/`Control` combos (except text editing
 *   ones like `$mod+a`, `$mod+z`), `Escape`, and F-keys still fire.
 * - On buttons, links, and similar: plain `Enter` and `Space`.
 * - Inside menus, listboxes, grids, tabs, and similar: plain arrow keys.
 */
export function defaultKeybindingsHandlerIgnore(event: KeyboardEvent): boolean {
  if (event.isComposing) return true;
  const target = event.target as Partial<Element> | null;
  if (target == null || target === event.currentTarget || typeof target.matches !== "function") {
    return false;
  }
  const { key } = event;
  const shortcut = event.ctrlKey || event.metaKey;
  if (target.matches(EDITABLE)) {
    return shortcut ? TEXT_EDIT_COMBO.test(key) : !NON_TEXT_KEY.test(key);
  }
  if (shortcut || event.altKey) return false;
  if (key === "Enter" || key === " ") return target.matches(PRESSABLE);
  if (key.startsWith("Arrow")) return target.closest?.(ARROW_WIDGET) != null;
  return false;
}

/**
 * Stack of active exclusive subscriptions. While non-empty, only the top one
 * receives events.
 */
const layers: object[] = [];
/** Events already seen by the top layer, so a layer that closes mid-dispatch doesn't leak them. */
const claimed = new WeakSet<Event>();

/**
 * Autocomplete selection can fire a plain `Event` named "keydown"; only
 * handle real keyboard events.
 */
function isKeyboardEvent(event: Event): event is KeyboardEvent {
  return typeof (event as Partial<KeyboardEvent>).key === "string";
}

interface Binding {
  readonly input: string;
  readonly presses: readonly KeybindingPress[];
  readonly config: KeybindingConfig;
  /** Index of the next expected press. */
  index: number;
}

/**
 * A keyboard event listener produced by {@link createKeybindingsHandler}.
 */
export interface KeybindingsListener {
  (event: Event): void;
  /** Clears all in-progress sequences. */
  reset(): void;
}

function toConfig(value: KeybindingValue): KeybindingConfig {
  return typeof value === "function" ? { handler: value } : value;
}

function defaultOnConflict(binding: string, pending: readonly string[]): void {
  console.warn(`microkeys: Conflict found, "${binding}" did not fire, waiting for:`, pending);
}

/**
 * Creates an event listener for handling keybindings. Keybinding strings are
 * parsed and validated once, up front (invalid ones throw `SyntaxError`, and
 * literal ones fail to type-check).
 *
 * @example
 * ```ts
 * const listener = createKeybindingsHandler({
 *   "Shift+d": () => alert("Shift and d pressed together"),
 *   "y e e t": () => alert("y, e, e, t pressed in order"),
 *   "$mod+s": { handler: save, preventDefault: true },
 * });
 * window.addEventListener("keydown", listener);
 * ```
 */
export function createKeybindingsHandler<const K extends string>(
  keybindingsMap: Keybindings<K>,
  options: KeybindingHandlerOptions = {},
): KeybindingsListener {
  const timeout = options.timeout ?? DEFAULT_TIMEOUT;
  const ignore = options.ignore ?? defaultKeybindingsHandlerIgnore;
  const onConflict =
    options.onConflict === false ? undefined : (options.onConflict ?? defaultOnConflict);

  const map = keybindingsMap as unknown as KeybindingsMap;
  const bindings: Binding[] = Object.keys(map).map((input) => ({
    input,
    presses: parseKeybinding(input),
    config: toConfig(map[input]!),
    index: 0,
  }));

  let hasPending = false;
  let lastTime = 0;

  function reset(): void {
    for (const binding of bindings) binding.index = 0;
    hasPending = false;
  }

  const listener = (event: Event): void => {
    if (!isKeyboardEvent(event) || ignore(event)) return;

    // Expire stale sequences lazily instead of running a timer per event.
    const now = Date.now();
    if (hasPending && now - lastTime > timeout) reset();
    lastTime = now;

    const info = eventInfo(event);
    // Holding a modifier down between presses must not break a sequence.
    const heldBit = modifierBit(info.key);
    const isHeldModifier = heldBit !== 0 && (info.mods & heldBit) !== 0;
    const isRepeat = event.repeat;

    let conflicts: string[] | undefined;
    let fired: Binding | undefined;

    for (const binding of bindings) {
      const { presses, config } = binding;
      if (isRepeat && !config.repeat) continue;

      let matched = matchPress(info, presses[binding.index]!);
      if (!matched && binding.index > 0) {
        if (isHeldModifier) continue;
        // Restart: this press may begin the sequence anew ("g i" on "ggi").
        binding.index = 0;
        matched = matchPress(info, presses[0]!);
      }
      if (!matched) continue;

      if (binding.index < presses.length - 1) {
        binding.index++;
        (conflicts ??= []).push(binding.input);
        continue;
      }

      binding.index = 0;
      if (conflicts) {
        onConflict?.(binding.input, conflicts);
        continue;
      }
      if (config.when && !config.when(event)) continue;

      if (config.preventDefault ?? options.preventDefault) {
        event.preventDefault();
      }
      if (config.stopPropagation ?? options.stopPropagation) {
        event.stopPropagation();
      }
      fired = binding;
      config.handler(event, { binding: binding.input });
      break;
    }

    hasPending = bindings.some((b) => b.index > 0);

    if (fired?.config.once) {
      const i = bindings.indexOf(fired);
      if (i !== -1) bindings.splice(i, 1);
    }
  };

  return Object.assign(listener, { reset });
}

/**
 * Subscribes to keybindings on a target. Returns an unsubscribe function.
 *
 * @example
 * ```ts
 * const unsubscribe = microkeys(window, {
 *   "Shift+d": () => alert("Shift and d pressed together"),
 *   "g i": () => goToInbox(),
 *   "$mod+k": { handler: openPalette, preventDefault: true },
 * });
 * ```
 */
export function microkeys<const K extends string>(
  target: KeybindingTarget,
  keybindingsMap: Keybindings<K>,
  options: KeybindingOptions = {},
): () => void {
  const type = options.event ?? "keydown";
  const capture = options.capture ?? false;
  const handler = createKeybindingsHandler(keybindingsMap, options);
  const { signal } = options;

  if (signal?.aborted) return () => {};

  const layer = {};
  const listener = (event: Event): void => {
    if (layers.length > 0 && layers[layers.length - 1] !== layer) return;
    if (claimed.has(event)) return;
    if (options.exclusive) claimed.add(event);
    handler(event);
  };
  if (options.exclusive) layers.push(layer);

  const unsubscribe = () => {
    target.removeEventListener(type, listener, capture);
    signal?.removeEventListener("abort", unsubscribe);
    const i = layers.indexOf(layer);
    if (i !== -1) layers.splice(i, 1);
  };
  target.addEventListener(type, listener, capture);
  signal?.addEventListener("abort", unsubscribe, { once: true });
  return unsubscribe;
}
