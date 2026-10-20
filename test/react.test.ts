import { act, createElement, useRef, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { expect, onTestFinished, test, vi } from "vite-plus/test";
import { useKeybinding, useKeybindings, type UseKeybindingsOptions } from "../src/react";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function render(node: ReactNode) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(node));
  const unmount = () => {
    act(() => root.unmount());
    container.remove();
  };
  onTestFinished(() => {
    if (container.isConnected) unmount();
  });
  return {
    container,
    rerender: (next: ReactNode) => act(() => root.render(next)),
    unmount,
  };
}

function press(key: string, target: EventTarget = window) {
  target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
}

function Bindings(props: { onA: () => void; options?: UseKeybindingsOptions }) {
  useKeybindings({ a: props.onA }, props.options);
  return null;
}

test("fires while mounted and unsubscribes on unmount", () => {
  const cb = vi.fn();
  const { unmount } = render(createElement(Bindings, { onA: cb }));
  press("a");
  unmount();
  press("a");
  expect(cb).toHaveBeenCalledOnce();
});

test("uses the latest handler without resubscribing", () => {
  const first = vi.fn();
  const second = vi.fn();
  const add = vi.spyOn(window, "addEventListener");
  onTestFinished(() => add.mockRestore());
  const { rerender } = render(createElement(Bindings, { onA: first }));
  rerender(createElement(Bindings, { onA: second }));
  press("a");
  expect(first).not.toHaveBeenCalled();
  expect(second).toHaveBeenCalledOnce();
  expect(add.mock.calls.filter(([type]) => type === "keydown")).toHaveLength(1);
});

test("enabled: false", () => {
  const cb = vi.fn();
  const { rerender } = render(createElement(Bindings, { onA: cb, options: { enabled: false } }));
  press("a");
  expect(cb).not.toHaveBeenCalled();
  rerender(createElement(Bindings, { onA: cb, options: { enabled: true } }));
  press("a");
  expect(cb).toHaveBeenCalledOnce();
});

test("ref target", () => {
  const cb = vi.fn();
  function Scoped() {
    const ref = useRef<HTMLDivElement>(null);
    useKeybinding("a", cb, { target: ref });
    return createElement("div", { ref, id: "scoped" });
  }
  const { container } = render(createElement(Scoped));
  press("a");
  expect(cb).not.toHaveBeenCalled();
  press("a", container.querySelector("#scoped")!);
  expect(cb).toHaveBeenCalledOnce();
});
