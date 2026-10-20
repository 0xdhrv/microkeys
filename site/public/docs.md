# microkeys docs

Everything microkeys exports, with bindings checked at compile time.

## Install

```
npm i microkeys
```

## Usage

`microkeys(target, bindings, options?)` returns an unsubscribe function.

```ts
import { microkeys } from "microkeys"

const unsubscribe = microkeys(window, {
  "Shift+D": () => alert("Shift and D pressed together"),
  "g i": () => goToInbox(), // sequence: g, then i
  "$mod+k": { handler: openPalette, preventDefault: true },
  "(F[1-9])": (event) => openTab(event.key), // regex key
})
```

Handlers receive the event and a context carrying the matched binding.

```ts
microkeys(window, {
  "$mod+s": (event, { binding }) => {
    // event: KeyboardEvent, binding: "$mod+s" (literal type)
  },
})
```

## Syntax

```
<sequence> = <press> <press> ...       whitespace-separated
<press>    = <key> | <mods>+<key>
<mod>      = <modifier> (required) | [<modifier>] (optional)
<key>      = KeyboardEvent.key | KeyboardEvent.code  (case-insensitive)
<key>      = (<regex>)  →  /^(?:<regex>)$/i, tested against key and code
```

| Modifier | Aliases (case-insensitive)           |
| -------- | ------------------------------------ |
| Shift    |                                      |
| Control  | Ctrl                                 |
| Alt      | Option, Opt                          |
| Meta     | Cmd, Command                         |
| AltGraph |                                      |
| $mod     | Meta on Apple devices, else Control  |

A modifier that isn't in the binding blocks the match: `a` doesn't fire on Shift+A unless it's optional, as in `[Shift]+a`. Shifted symbols need Shift spelled out: `Shift+?`, not `?`.

Literal bindings are type-checked. `"Hyper+k"` and `"Shift+"` fail to compile; computed strings that slip through throw a `SyntaxError` when the handler is created.

## Binding options

A binding's value is a handler or a config object.

```ts
microkeys(window, {
  ArrowDown: { handler: next, repeat: true }, // fire while held
  Enter: { handler: save, when: () => isEditing }, // falls through when false
  enter: open, // runs when the binding above doesn't
  "Shift+?": { handler: showHelp, once: true },
  Escape: { handler: close, preventDefault: true, stopPropagation: true },
})
```

| Option          | Default | Description                                                      |
| --------------- | ------- | ---------------------------------------------------------------- |
| handler         | —       | `(event, { binding }) => void`                                   |
| preventDefault  | global  | Call `event.preventDefault()` when fired                         |
| stopPropagation | global  | Call `event.stopPropagation()` when fired                        |
| repeat          | false   | Fire on auto-repeat events                                       |
| when            | —       | Fire only if it returns true; otherwise try the next binding     |
| once            | false   | Remove the binding after it fires                                |

## Global options

| Option          | Default        | Description                                                               |
| --------------- | -------------- | ------------------------------------------------------------------------- |
| event           | "keydown"      | Or "keyup"                                                                |
| capture         | false          | Listen in the capture phase                                               |
| signal          | —              | AbortSignal; aborting unsubscribes                                        |
| timeout         | 1000           | Max ms between presses in a sequence                                      |
| preventDefault  | false          | Default for every binding                                                 |
| stopPropagation | false          | Default for every binding                                                 |
| ignore          | default        | Return true to skip an event                                              |
| onConflict      | console.warn   | Called when a binding yields to a longer sequence; false silences it      |

By default `ignore` skips IME composition and events from inputs, textareas, selects, and contenteditable elements, unless that element is the listener's own target. To extend it:

```ts
import { defaultKeybindingsHandlerIgnore } from "microkeys"

microkeys(window, bindings, {
  ignore: (e) =>
    defaultKeybindingsHandlerIgnore(e) || (e.target as Element).closest("dialog") != null,
})
```

## Formatting

`formatKeybinding` turns a binding into display text, with Apple symbols on macOS and iOS.

```ts
import { formatKeybinding } from "microkeys"

formatKeybinding("$mod+Shift+k") // "⇧⌘K" on macOS, "Ctrl+Shift+K" elsewhere
formatKeybinding("g i") // "G I"
formatKeybinding("Control+Enter", { apple: true }) // "⌃↩"
formatKeybinding("g i", { sequenceSeparator: " then " }) // "G then I"
```

## Lower-level API

```ts
import { createKeybindingsHandler } from "microkeys"

const listener = createKeybindingsHandler({ "g i": goToInbox })
element.addEventListener("keydown", listener)
listener.reset() // clear in-progress sequences
```

Also exported: `parseKeybinding`, `matchKeybindingPress`, `eventModifiers`, `IS_APPLE`, and the types `Keybindings`, `KeybindingConfig`, `IsValidKeybinding`.
