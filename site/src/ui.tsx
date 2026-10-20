import { formatKeybinding, IS_APPLE } from "microkeys";
import { TextMorph } from "torph/react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { installKeySounds, isSoundOn, setSoundOn, subscribeSound } from "./sound";

/** Splits a keybinding into keycap labels, grouped by sequence press. */
export function keycaps(binding: string, apple = IS_APPLE): string[][] {
  return formatKeybinding(binding, {
    apple,
    separator: "\u0001",
    sequenceSeparator: "\u0002",
  })
    .split("\u0002")
    .map((press) => press.split("\u0001"));
}

export function Kbd({
  children,
  active,
  done,
  size,
}: {
  children: ReactNode;
  active?: boolean;
  done?: boolean;
  size?: "lg";
}) {
  return (
    <kbd className="kbd" data-active={active} data-done={done} data-size={size}>
      {children}
    </kbd>
  );
}

/** Renders a keybinding as keycaps, e.g. `$mod+k` → [⌘][K]. */
export function Binding({
  binding,
  apple,
  size,
}: {
  binding: string;
  apple?: boolean;
  size?: "lg";
}) {
  return (
    <span className="kbd-row">
      {keycaps(binding, apple).map((press, i) => (
        <span className="kbd-row" key={i}>
          {i > 0 && <span className="kbd-then">then</span>}
          {press.map((cap, j) => (
            <Kbd key={j} size={size}>
              {cap}
            </Kbd>
          ))}
        </span>
      ))}
    </span>
  );
}

export function useCopy(timeout = 1500) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = useCallback(
    async (text: string) => {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), timeout);
    },
    [timeout],
  );
  return { copied, copy };
}

const TOKEN =
  /(\/\/.*$)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|\b(import|from|export|const|let|function|return|new|await|async|type|true|false)\b|([{}()[\];,])/gm;

/** Minimal JS/TS highlighter; good enough for short usage snippets. */
function highlight(code: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const match of code.matchAll(TOKEN)) {
    const index = match.index;
    if (index > last) out.push(code.slice(last, index));
    const cls = match[1] ? "tok-c" : match[2] ? "tok-s" : match[3] ? "tok-k" : "tok-p";
    out.push(
      <span className={cls} key={index}>
        {match[0]}
      </span>,
    );
    last = index + match[0].length;
  }
  out.push(code.slice(last));
  return out;
}

export function CodeBlock({
  code,
  prompt,
  plain,
}: {
  code: string;
  prompt?: boolean;
  plain?: boolean;
}) {
  const { copied, copy } = useCopy();
  return (
    <pre className="code">
      {prompt && <span className="tok-p">$ </span>}
      <code>{plain ? code : highlight(code)}</code>
      <button className="copy" onClick={() => copy(code)}>
        <TextMorph>{copied ? "Copied" : "Copy"}</TextMorph>
      </button>
    </pre>
  );
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: readonly T[];
  value: T;
  onChange: (tab: T) => void;
  label: string;
}) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map((tab) => (
        <button
          key={tab}
          role="tab"
          className="tab"
          aria-selected={tab === value}
          onClick={() => onChange(tab)}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}

/** Fixed top and bottom edges that progressively blur content scrolling beneath. */
export function EdgeBlur() {
  return (
    <>
      {(["top", "bottom"] as const).map((edge) => (
        <div className="edge-blur" data-edge={edge} aria-hidden key={edge}>
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
      ))}
    </>
  );
}

export function ThemeToggle() {
  const toggle = () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {}
  };
  return (
    <button className="icon-toggle" onClick={toggle} aria-label="Toggle theme">
      <svg
        className="icon-theme"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path
          d="m7,10c0-1.6569,1.3431-3,3-3V3c-1.7914,0-3.5829.6834-4.9498,2.0502-2.7336,2.7337-2.7336,7.1658,0,9.8995,1.3668,1.3668,3.1583,2.0502,4.9498,2.0502v-4c-1.6569,0-3-1.3431-3-3Z"
          fill="currentColor"
          stroke="none"
        />
        <path d="m10,7v6c1.6569,0,3-1.3431,3-3s-1.3431-3-3-3Z" fill="currentColor" stroke="none" />
        <circle cx="10" cy="10" r="7" />
      </svg>
    </button>
  );
}

/** Mounts the global key sounds for the page. */
export function KeySounds() {
  useEffect(() => installKeySounds(), []);
  return null;
}

export function SoundToggle() {
  const on = useSyncExternalStore(subscribeSound, isSoundOn, () => true);
  return (
    <button
      className="icon-toggle"
      onClick={() => setSoundOn(!on)}
      aria-label="Key sounds"
      aria-pressed={on}
    >
      <svg
        className="icon-volume"
        data-on={on}
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path
          d="m8,7h-3c-1.1046,0-2,.8954-2,2v2c0,1.1046.8954,2,2,2h3l4.5227,3.7689c.5866.4889,1.4773.0717,1.4773-.6919V3.923c0-.7636-.8906-1.1808-1.4773-.6919l-4.5227,3.7689Z"
          fill="currentColor"
        />
        <path className="icon-volume-wave" />
      </svg>
    </button>
  );
}
