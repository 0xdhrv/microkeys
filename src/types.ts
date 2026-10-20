/**
 * Valid targets for keydown/keyup events.
 */
export type KeybindingTarget = Window | Document | Element;

/**
 * Canonical modifier names, as used by `KeyboardEvent.getModifierState()`.
 */
export type Modifier = "Shift" | "Meta" | "Alt" | "Control" | "AltGraph";

/**
 * Every modifier spelling accepted in a keybinding string (case-insensitive).
 *
 * - `$mod` → `Meta` on Apple devices, `Control` elsewhere
 * - `Ctrl` → `Control`
 * - `Cmd` / `Command` → `Meta`
 * - `Option` / `Opt` → `Alt`
 */
export type ModifierAlias = Modifier | "$mod" | "Ctrl" | "Cmd" | "Command" | "Option" | "Opt";

type ModifierLower = Lowercase<ModifierAlias>;

/**
 * Context passed to every handler.
 */
export interface KeybindingContext<K extends string = string> {
  /** The keybinding string that matched, exactly as written in the map. */
  readonly binding: K;
}

/**
 * Keyboard event callback fired when a keybinding is triggered.
 */
export type KeybindingHandler<K extends string = string> = (
  event: KeyboardEvent,
  context: KeybindingContext<K>,
) => void;

/**
 * Per-binding options. Any option left unset falls back to the global option
 * of the same name.
 */
export interface KeybindingConfig<K extends string = string> {
  handler: KeybindingHandler<K>;
  /** Call `event.preventDefault()` when this binding fires. */
  preventDefault?: boolean;
  /** Call `event.stopPropagation()` when this binding fires. */
  stopPropagation?: boolean;
  /** Fire on auto-repeated key events (holding a key down). Default `false`. */
  repeat?: boolean;
  /** Only fire when this returns `true`. Checked at fire time. */
  when?: (event: KeyboardEvent) => boolean;
  /** Remove this binding after it fires once. */
  once?: boolean;
}

export type KeybindingValue<K extends string = string> = KeybindingHandler<K> | KeybindingConfig<K>;

/**
 * A map of keybinding strings to handlers or configs.
 */
export type KeybindingsMap = { [binding: string]: KeybindingValue<any> };

/**
 * Predicate that returns `true` if a keyboard event should be ignored.
 */
export type KeybindingFilter = (event: KeyboardEvent) => boolean;

export interface KeybindingHandlerOptions {
  /**
   * Max delay (ms) between presses of a sequence before it resets.
   * Default `1000`.
   */
  timeout?: number;
  /**
   * Which events to skip entirely. Default:
   * {@link defaultKeybindingsHandlerIgnore} (IME composition and editable
   * fields that aren't the listener's own target).
   *
   * Auto-repeat is handled separately by the per-binding `repeat` option.
   */
  ignore?: KeybindingFilter;
  /** Default for every binding's `preventDefault`. Default `false`. */
  preventDefault?: boolean;
  /** Default for every binding's `stopPropagation`. Default `false`. */
  stopPropagation?: boolean;
  /**
   * Called when a binding completes while a longer sequence that shares its
   * prefix is still pending. The completed binding does not fire.
   * Default: `console.warn`. Pass `false` to silence.
   */
  onConflict?: ((binding: string, pending: readonly string[]) => void) | false;
}

export interface KeybindingOptions extends KeybindingHandlerOptions {
  /** Event to listen to. Default `"keydown"`. */
  event?: "keydown" | "keyup";
  /** Use a capture listener. Default `false`. */
  capture?: boolean;
  /** Unsubscribe automatically when this signal aborts. */
  signal?: AbortSignal;
  /**
   * Take over the keyboard while subscribed, e.g. for a dialog. Every other
   * subscription pauses until this one unsubscribes. Exclusive subscriptions
   * stack: the most recent one wins. Default `false`.
   */
  exclusive?: boolean;
}

// ---------------------------------------------------------------------------
// Compile-time keybinding validation
// ---------------------------------------------------------------------------

type IsModifier<M extends string> = Lowercase<M> extends ModifierLower ? true : false;

/** Validates a single press, e.g. `Shift+[Alt]+k` or `$mod+(F[1-9])`. */
type IsValidPress<P extends string> = P extends ""
  ? false
  : P extends `(${string})`
    ? true
    : P extends `[${infer M}]+${infer Rest}`
      ? IsModifier<M> extends true
        ? IsValidKey<Rest>
        : false
      : P extends `${infer M}+${infer Rest}`
        ? M extends ""
          ? true // the key is "+" itself
          : IsModifier<M> extends true
            ? IsValidKey<Rest>
            : false
        : true;

type IsValidKey<Rest extends string> = Rest extends "" ? false : IsValidPress<Rest>;

type IsValidSequence<S extends string> = S extends ` ${infer Rest}`
  ? IsValidSequence<Rest>
  : S extends `${infer P} ${infer Rest}`
    ? IsValidPress<P> extends true
      ? Rest extends "" | " "
        ? true
        : IsValidSequence<Rest>
      : false
    : IsValidPress<S>;

/**
 * Resolves to `true` if `S` is a well-formed keybinding string. Non-literal
 * `string` is always accepted.
 */
export type IsValidKeybinding<S extends string> = string extends S ? true : IsValidSequence<S>;

/**
 * A type-checked keybindings map. Each handler's context is typed with its
 * own binding, and every invalid binding is reported by name.
 */
export type Keybindings<K extends string> = {
  [P in K]: IsValidKeybinding<P> extends true
    ? KeybindingValue<P>
    : `Invalid keybinding "${P}": unknown modifier or empty key`;
};
