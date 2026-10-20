import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { microkeys } from "./index";
import type {
  IsValidKeybinding,
  KeybindingConfig,
  KeybindingOptions,
  KeybindingTarget,
  KeybindingValue,
  Keybindings,
  KeybindingsMap,
} from "./types";

export interface UseKeybindingsOptions extends Omit<KeybindingOptions, "signal"> {
  /** Element, or ref to one, to listen on. Default `window`. */
  target?: KeybindingTarget | RefObject<Element | null>;
  /** Subscribe only while `true`. Default `true`. */
  enabled?: boolean;
}

const SEPARATOR = "\0";

function toConfig(value: KeybindingValue | undefined): Partial<KeybindingConfig> {
  return typeof value === "function" ? { handler: value } : (value ?? {});
}

/**
 * Subscribes to keybindings while the component is mounted.
 *
 * Handlers, `when`, `ignore`, and `onConflict` always see the latest render,
 * so inline functions don't resubscribe. The listener is recreated only when
 * the set of bindings or another option changes.
 *
 * @example
 * ```tsx
 * useKeybindings({
 *   "$mod+s": { handler: save, preventDefault: true },
 *   Escape: close,
 * });
 * ```
 */
export function useKeybindings<const K extends string>(
  keybindings: Keybindings<K>,
  options: UseKeybindingsOptions = {},
): void {
  const latest = useRef({
    keybindings: keybindings as unknown as KeybindingsMap,
    options,
  });
  useLayoutEffect(() => {
    latest.current = {
      keybindings: keybindings as unknown as KeybindingsMap,
      options,
    };
  });

  const keys = Object.keys(keybindings).join(SEPARATOR);
  const {
    target,
    enabled = true,
    event,
    capture,
    timeout,
    preventDefault,
    stopPropagation,
    exclusive,
  } = options;
  const hasIgnore = options.ignore !== undefined;
  const conflicts = options.onConflict === false ? false : options.onConflict !== undefined;

  useEffect(() => {
    if (!enabled) return;
    const element = target === undefined ? window : "current" in target ? target.current : target;
    if (!element) return;

    const current = (binding: string) => toConfig(latest.current.keybindings[binding]);
    const map: KeybindingsMap = {};
    for (const binding of keys ? keys.split(SEPARATOR) : []) {
      map[binding] = {
        ...current(binding),
        handler: (e, context) => current(binding).handler?.(e, context),
        when: (e) => current(binding).when?.(e) ?? true,
      };
    }

    const { target: _target, enabled: _enabled, ...subscription } = latest.current.options;
    if (hasIgnore) subscription.ignore = (e) => latest.current.options.ignore?.(e) ?? false;
    if (conflicts) {
      subscription.onConflict = (binding, pending) => {
        const onConflict = latest.current.options.onConflict;
        if (onConflict) onConflict(binding, pending);
      };
    }
    return microkeys(element, map, subscription);
  }, [
    keys,
    target,
    enabled,
    event,
    capture,
    timeout,
    preventDefault,
    stopPropagation,
    exclusive,
    hasIgnore,
    conflicts,
  ]);
}

/**
 * Subscribes to a single keybinding while the component is mounted.
 *
 * @example
 * ```tsx
 * useKeybinding("$mod+k", openPalette, { preventDefault: true });
 * ```
 */
export function useKeybinding<const K extends string>(
  binding: K & (IsValidKeybinding<K> extends true ? unknown : never),
  value: KeybindingValue<K>,
  options?: UseKeybindingsOptions,
): void {
  useKeybindings({ [binding]: value } as unknown as Keybindings<K>, options);
}
