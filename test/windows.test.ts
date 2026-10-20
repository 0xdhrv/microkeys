import { expect, onTestFinished, test, vi } from "vite-plus/test";

// Platform is read at module load, so stub it before importing.
vi.stubGlobal("navigator", { platform: "Win32" });
const { microkeys } = await import("../src/index");

// happy-dom reports AltGraph whenever altKey is set, so stub the state.
function ctrlAlt(key: string, code: string, altGraph: boolean) {
  const event = new KeyboardEvent("keydown", {
    key,
    code,
    ctrlKey: true,
    altKey: true,
  });
  const native = event.getModifierState.bind(event);
  event.getModifierState = (m: string) => (m === "AltGraph" ? altGraph : native(m));
  window.dispatchEvent(event);
}

const altGr = (key: string, code: string) => ctrlAlt(key, code, true);

test("typing a character with AltGr doesn't fire Control+Alt shortcuts", () => {
  const cb = vi.fn();
  onTestFinished(microkeys(window, { "Control+Alt+KeyQ": cb, "Control+Alt+e": cb }));
  altGr("@", "KeyQ"); // German layout
  altGr("€", "KeyE");
  expect(cb).not.toHaveBeenCalled();
});

test("Control+Alt fires when it doesn't produce a character", () => {
  const cb = vi.fn();
  onTestFinished(microkeys(window, { "Control+Alt+KeyQ": cb }));
  ctrlAlt("q", "KeyQ", false);
  expect(cb).toHaveBeenCalledOnce();
});

test("AltGr bindings and typed-character bindings still fire", () => {
  const cb = vi.fn();
  onTestFinished(microkeys(window, { "AltGraph+KeyQ": cb, "Control+Alt+@": cb }));
  altGr("@", "KeyQ");
  expect(cb).toHaveBeenCalledOnce();
});
