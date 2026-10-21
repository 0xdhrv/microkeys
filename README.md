# microkeys

<div align="center">
  <img src="./assets/microkeys-mark.svg" alt="microkeys keycap mascot hopping" width="96" height="136" />
</div>

A tiny, fast, type-safe keybinding library, inspired by
[tinykeys](https://github.com/jamiebuilds/tinykeys).

- **~2 KB gzipped**, zero dependencies, ESM + CJS
- **Type-checked bindings**: `"Hyper+k"` or `"Shift+"` fail to compile
- **Fast dispatch**: bitmask modifiers, no per-event timers
- Per-binding `preventDefault`, `stopPropagation`, `repeat`, `when`, `once`
- Works on non-Latin layouts, ignores AltGr typing, and leaves typing alone
  while `$mod+s` and `Escape` still work in text fields
- Exclusive scopes for dialogs, a shortcut recorder, and React hooks
- `AbortSignal` support, modifier aliases (`Ctrl`, `Cmd`, `Option`), display formatting

```sh
npm install microkeys
```

## Usage

```ts
import { microkeys } from "microkeys";

const unsubscribe = microkeys(window, {
  "Shift+D": () => alert("Shift and D pressed together"),
  "g i": () => goToInbox(), // sequence: g, then i
  "$mod+k": { handler: openPalette, preventDefault: true },
  "(F[1-9])": (event) => openTab(event.key), // regex key
});
```

Handlers receive the event and a context carrying the matched binding:

```ts
microkeys(window, {
  "$mod+s": (event, { binding }) => {
    // event: KeyboardEvent, binding: "$mod+s" (literal type)
  },
});
```

## Keybinding syntax

```
<sequence> = <press> <press> ...         (whitespace-separated)
<press>    = <key> | <mods>+<key>
<mod>      = <modifier> (required) | [<modifier>] (optional)
<key>      = KeyboardEvent.key | KeyboardEvent.code   (case-insensitive)
<key>      = (<regex>)  →  /^(?:<regex>)$/i, tested against key and code
```

| Modifier   | Aliases (case-insensitive)              |
| ---------- | --------------------------------------- |
| `Shift`    |                                         |
| `Control`  | `Ctrl`                                  |
| `Alt`      | `Option`, `Opt`                         |
| `Meta`     | `Cmd`, `Command`                        |
| `AltGraph` |                                         |
| `$mod`     | `Meta` on Apple devices, else `Control` |

Pressing a modifier that isn't in the binding prevents a match (`a` doesn't
fire on `Shift+a`), unless it's marked optional: `[Shift]+a`. Shifted symbols
therefore need Shift spelled out: `Shift+?`, not `?`.

### Keyboard layouts

Letters match the character typed, so `$mod+z` follows the Z key on AZERTY
and Dvorak. When the typed character isn't ASCII (Russian `я`, or `å` from
Option+A on macOS), the letter or digit of the physical key is used instead,
so `Control+s` and `Alt+a` still work. Write `KeyZ` to bind the physical key.

On Windows, AltGr reports as Control+Alt. A character typed with AltGr (`@`
on a German keyboard) doesn't fire a `Control+Alt+KeyQ` binding. Bind it
with `AltGraph+KeyQ` or `Control+Alt+@`.

## Binding options

A binding's value is a handler or a config object:

```ts
microkeys(window, {
  ArrowDown: { handler: next, repeat: true }, // fire while held
  Enter: { handler: save, when: () => isEditing }, // falls through when false
  enter: open, // runs when the binding above doesn't
  "Shift+?": { handler: showHelp, once: true },
  Escape: { handler: close, preventDefault: true, stopPropagation: true },
});
```

| Option            | Default | Description                                               |
| ----------------- | ------- | --------------------------------------------------------- |
| `handler`         | —       | `(event, { binding }) => void`                            |
| `preventDefault`  | global  | Call `event.preventDefault()` when fired                  |
| `stopPropagation` | global  | Call `event.stopPropagation()` when fired                 |
| `repeat`          | `false` | Fire on auto-repeat events                                |
| `when`            | —       | Fire only if it returns `true`; else try the next binding |
| `once`            | `false` | Remove the binding after it fires                         |

## Global options

```ts
microkeys(target, bindings, {
  event: "keydown", // or "keyup"
  capture: false,
  signal: controller.signal, // unsubscribe on abort
  timeout: 1000, // max ms between sequence presses
  preventDefault: false, // default for every binding
  stopPropagation: false, // default for every binding
  ignore: defaultKeybindingsHandlerIgnore,
  onConflict: (binding, pending) => {}, // or false to silence
  exclusive: false, // take over the keyboard while subscribed
});
```

The default `ignore` leaves keys to the browser or the focused control when
they belong there. It never ignores events whose target is the listener's own
target.

| Focus                                            | Ignored                                                                                                                                                                |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Anywhere, during IME composition                 | Everything                                                                                                                                                             |
| Text inputs, textareas, selects, contenteditable | Typing. `$mod`/`Control` combos, `Escape`, and F-keys still fire, except text editing combos (`$mod+a`, `c`, `v`, `x`, `y`, `z`, arrows, Backspace, Delete, Home, End) |
| Buttons, links, checkboxes, `role="button"`…     | Plain `Enter` and `Space`                                                                                                                                              |
| Inside menus, listboxes, grids, tablists…        | Plain arrow keys                                                                                                                                                       |

To extend it:

```ts
import { defaultKeybindingsHandlerIgnore } from "microkeys";

microkeys(window, bindings, {
  ignore: (e) =>
    defaultKeybindingsHandlerIgnore(e) ||
    (e.target as Element).closest("dialog") != null,
});
```

## Exclusive scopes

A dialog can take over the keyboard. While an `exclusive` subscription is
active, every other subscription pauses, so `Escape` closes the dialog
without also reaching the page. Exclusive subscriptions stack: the newest
wins, and the previous one resumes when it unsubscribes.

```ts
function openDialog() {
  const close = microkeys(
    window,
    { Escape: () => close() },
    { exclusive: true },
  );
}
```

## Recording shortcuts

```ts
import { recordKeybinding, keybindingFromEvent } from "microkeys";

const binding = await recordKeybinding(); // user presses ⌘⇧K → "$mod+Shift+k"
microkeys(window, { [binding]: run });

recordKeybinding(window, { signal: controller.signal, mod: false }); // "Meta+Shift+k"
keybindingFromEvent(event); // same conversion for your own listener
```

`recordKeybinding` waits for a non-modifier key, then `preventDefault`s it.
The result matches the press that produced it.

## React

```tsx
import { useKeybinding, useKeybindings } from "microkeys/react";

function Editor() {
  const ref = useRef<HTMLDivElement>(null);
  useKeybindings({
    "$mod+s": { handler: save, preventDefault: true },
    "g i": goToInbox,
  });
  useKeybinding("Escape", close, {
    target: ref,
    exclusive: true,
    enabled: isOpen,
  });
  return <div ref={ref} />;
}
```

Hooks take every global option, plus `target` (an element or ref, default
`window`) and `enabled`. Handlers, `when`, `ignore`, and `onConflict` always
use the latest render, so inline functions don't resubscribe. Other
per-binding options apply when the listener is created.

## Formatting for display

```ts
import { formatKeybinding } from "microkeys";

formatKeybinding("$mod+Shift+k"); // "⇧⌘K" on macOS, "Ctrl+Shift+K" elsewhere
formatKeybinding("g i"); // "G I"
formatKeybinding("Control+Enter", { apple: true }); // "⌃↩"
formatKeybinding("g i", { sequenceSeparator: " then " }); // "G then I"
```

## Lower-level API

```ts
import { createKeybindingsHandler } from "microkeys";

const listener = createKeybindingsHandler({ "g i": goToInbox });
element.addEventListener("keydown", listener);
listener.reset(); // clear in-progress sequences
```

Also exported: `parseKeybinding`, `matchKeybindingPress`, `eventModifiers`,
`IS_APPLE`, and types (`Keybindings`, `KeybindingConfig`,
`IsValidKeybinding`, …).

## Development

```sh
npm test          # runtime tests (happy-dom) + type tests
npm run typecheck
npm run build     # tsdown → dist/ (ESM + CJS + .d.ts)
npm run bench     # dispatch benchmark
```

The demo site lives in `site/` (Vite+ and React). It imports the library from
`src/` directly, so changes show up live:

```sh
npm --prefix site install
npm run site:dev    # / demo, /tests/ in-browser test cases, /docs/ reference
npm run site:build  # static output in site/dist
```

Test cases are defined in `site/src/tests/cases.ts`.

## License

MIT. See [LICENSE](LICENSE).
