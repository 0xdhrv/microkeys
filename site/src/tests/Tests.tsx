import { IS_APPLE, microkeys, parseKeybinding } from "microkeys";
import { useEffect, useMemo, useRef, useState } from "react";
import { Binding, Kbd, keycaps, KeySounds, SoundToggle, ThemeToggle, useCopy } from "../ui";
import { CASES, type Case, type Press } from "./cases";
import { runCase, toEventInit, type CaseResult } from "./runner";
import { Sandbox } from "./Sandbox";

/** Renders `backticked` spans as <code>. */
function inlineCode(text: string) {
  return text.split(/`([^`]+)`/).map((part, i) => (i % 2 ? <code key={i}>{part}</code> : part));
}

const MOD_SYMBOLS = {
  apple: { ctrl: "⌃", alt: "⌥", shift: "⇧", meta: "⌘", altGraph: "⌥" },
  pc: {
    ctrl: "Ctrl",
    alt: "Alt",
    shift: "Shift",
    meta: "Win",
    altGraph: "AltGr",
  },
};

const MODIFIER_KEYS = {
  Shift: "shift",
  Control: "ctrl",
  Alt: "alt",
  Meta: "meta",
} as const;

/** Keycap labels for a simulated press, e.g. ⇧ + A. */
function pressCaps(press: Press, apple: boolean): string[] {
  const symbols = MOD_SYMBOLS[apple ? "apple" : "pc"];
  const own = MODIFIER_KEYS[press.key as keyof typeof MODIFIER_KEYS];
  const caps = (["ctrl", "alt", "altGraph", "shift", "meta"] as const)
    .filter((m) => press[m] && m !== own)
    .map((m) => symbols[m]);
  const key = own
    ? symbols[own]
    : press.key === " "
      ? "Space"
      : (keycaps(press.key, apple)[0]?.at(-1) ?? press.key);
  return [...new Set(caps), key];
}

interface Settings {
  apple: boolean;
  speed: number;
  roomy: boolean;
  failingOnly: boolean;
}

const STORAGE = "microkeys-tape";

// Read before first render so a refresh never flashes the defaults.
function loadSettings(): Settings {
  const fallback: Settings = {
    apple: IS_APPLE,
    speed: 1,
    roomy: false,
    failingOnly: false,
  };
  try {
    return {
      ...fallback,
      ...JSON.parse(localStorage.getItem(STORAGE) ?? "{}"),
    };
  } catch {
    return fallback;
  }
}

const SPEEDS = [0.5, 1, 2, 4];
/** Milliseconds one tape column takes to play at 1×. */
const BEAT = 520;

export function Tests() {
  const [results, setResults] = useState<Record<string, CaseResult>>({});
  const [run, setRun] = useState(0);
  const [settings, setSettings] = useState(loadSettings);
  const [filter, setFilter] = useState("");
  const [playAll, setPlayAll] = useState(0);
  const [live, setLive] = useState(false);
  const [options, setOptions] = useState(false);
  const filterRef = useRef<HTMLInputElement>(null);
  const { apple, speed, roomy, failingOnly } = settings;

  const set = (patch: Partial<Settings>) =>
    setSettings((s) => {
      const next = { ...s, ...patch };
      try {
        localStorage.setItem(STORAGE, JSON.stringify(next));
      } catch {}
      return next;
    });

  // Run every case sequentially; timeouts in some cases use real time.
  useEffect(() => {
    let cancelled = false;
    setResults({});
    (async () => {
      for (const c of CASES) {
        const result = await runCase(c);
        if (cancelled) return;
        setResults((r) => ({ ...r, [c.id]: result }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [run]);

  // Dogfood: the page's own shortcuts.
  useEffect(
    () =>
      microkeys(window, {
        "/": {
          handler: () => filterRef.current?.focus(),
          preventDefault: true,
        },
        r: () => setRun((n) => n + 1),
        p: () => setPlayAll((n) => n + 1),
      }),
    [],
  );

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return CASES.filter(
      (c) =>
        (!failingOnly || results[c.id]?.pass === false) &&
        (!q ||
          [c.title, c.group, c.description, ...c.tags, ...Object.keys(c.bindings)]
            .join(" ")
            .toLowerCase()
            .includes(q)),
    );
  }, [filter, failingOnly, results]);

  const groups = useMemo(() => {
    const map = new Map<string, Case[]>();
    for (const c of visible) map.set(c.group, [...(map.get(c.group) ?? []), c]);
    return [...map];
  }, [visible]);

  const done = Object.values(results);
  const passing = done.filter((r) => r.pass).length;
  const failing = done.length - passing;

  return (
    <div className="tape" data-roomy={roomy}>
      <KeySounds />
      <header className="tape-bar">
        <a href="/" className="tape-home" aria-label="Back to microkeys home">
          <span aria-hidden>←</span> microkeys
        </a>
        <span className="tape-tally" aria-live="polite">
          <b>{passing}</b> pass
          {failing > 0 && (
            <>
              {" "}
              · <b className="fail-text">{failing}</b> fail
            </>
          )}
          {done.length < CASES.length && (
            <span className="dim"> · {CASES.length - done.length} running</span>
          )}
        </span>
        <input
          ref={filterRef}
          className="tape-filter"
          placeholder="Filter strips…"
          aria-label="Filter strips"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && e.currentTarget.blur()}
        />
        <div className="seg" role="group" aria-label="Show">
          <button
            aria-pressed={!failingOnly}
            onClick={() => withTransition(() => set({ failingOnly: false }))}
          >
            All
          </button>
          <button
            aria-pressed={failingOnly}
            onClick={() => withTransition(() => set({ failingOnly: true }))}
          >
            Failing
          </button>
        </div>
        <div className="tape-actions">
          <button className="tape-btn" onClick={() => setPlayAll((n) => n + 1)}>
            ▶ Play all
          </button>
          <button className="tape-btn" onClick={() => setRun((n) => n + 1)}>
            Rerun
          </button>
          <button
            className="tape-btn"
            aria-expanded={options}
            aria-controls="tape-options"
            onClick={() => setOptions((o) => !o)}
          >
            View
          </button>
          <SoundToggle />
          <ThemeToggle />
        </div>
        {options && (
          <div id="tape-options" className="tape-options">
            <div className="seg" role="group" aria-label="Keycap style">
              <button aria-pressed={apple} onClick={() => set({ apple: true })}>
                Apple
              </button>
              <button aria-pressed={!apple} onClick={() => set({ apple: false })}>
                PC
              </button>
            </div>
            <div className="seg" role="group" aria-label="Playback speed">
              {SPEEDS.map((s) => (
                <button key={s} aria-pressed={speed === s} onClick={() => set({ speed: s })}>
                  {s}×
                </button>
              ))}
            </div>
            <div className="seg" role="group" aria-label="Density">
              <button aria-pressed={!roomy} onClick={() => set({ roomy: false })}>
                Tight
              </button>
              <button aria-pressed={roomy} onClick={() => set({ roomy: true })}>
                Roomy
              </button>
            </div>
          </div>
        )}
      </header>

      <main className="tape-main">
        <section className="live">
          <button
            className="live-toggle"
            aria-expanded={live}
            onClick={() => withTransition(() => setLive((l) => !l))}
          >
            <span className="pg-chevron" aria-hidden>
              ›
            </span>
            Live tape
            <span className="dim">type your own bindings, press real keys</span>
          </button>
          {live && <Sandbox apple={apple} />}
        </section>

        {groups.length === 0 && (
          <div className="tape-empty">
            <h2>Nothing on the reel</h2>
            <p>No strips match. Clear the filter to see every case again.</p>
            <button
              className="tape-btn"
              onClick={() => {
                setFilter("");
                set({ failingOnly: false });
              }}
            >
              Clear filters
            </button>
          </div>
        )}

        {groups.map(([group, cases]) => {
          const bad = cases.filter((c) => results[c.id]?.pass === false).length;
          return (
            <section key={group} className="reel">
              <h2 className="reel-title">
                {group}
                <span className="reel-count">
                  {cases.length}
                  {bad > 0 && <span className="fail-text"> · {bad} fail</span>}
                </span>
              </h2>
              {cases.map((c) => (
                <Strip
                  key={c.id}
                  c={c}
                  result={results[c.id]}
                  apple={apple}
                  speed={speed}
                  playAll={playAll}
                />
              ))}
            </section>
          );
        })}

        <p className="tape-foot">
          <Kbd>/</Kbd> filter · <Kbd>P</Kbd> play all · <Kbd>R</Kbd> rerun · click a press to
          inspect its event · cases live in <code className="path">site/src/tests/cases.ts</code>
        </p>
      </main>
    </div>
  );
}

type Cell = "hit" | "extra" | "miss" | "idle" | "expect";

function Strip({
  c,
  result,
  apple,
  speed,
  playAll,
}: {
  c: Case;
  result: CaseResult | undefined;
  apple: boolean;
  speed: number;
  playAll: number;
}) {
  const [head, setHead] = useState(-1);
  const [sel, setSel] = useState<number | null>(null);
  const timers = useRef<number[]>([]);
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const { copied, copy } = useCopy();
  const status = !result ? "running" : result.pass ? "pass" : "fail";

  const stop = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  const play = () => {
    stop();
    let t = 0;
    c.steps.forEach((s, i) => {
      t += (Math.min(s.press.wait ?? 0, 1200) + (i ? BEAT : 0)) / speedRef.current;
      timers.current.push(window.setTimeout(() => setHead(i), t));
    });
    timers.current.push(window.setTimeout(() => setHead(-1), t + 1100 / speedRef.current));
  };
  useEffect(() => stop, []);
  useEffect(() => {
    if (playAll) play();
  }, [playAll]);

  const bindings = Object.entries(c.bindings);
  const hasFlags = c.steps.some((s) => s.prevented !== undefined || s.stopped !== undefined);

  // Columns: a label, then a wait gap (if any) and a press for every step.
  const gridCols = [
    "minmax(120px, max-content)",
    ...c.steps.flatMap((s) => [
      ...(s.press.wait ? [`${20 + Math.round((Math.min(s.press.wait, 1500) / 1500) * 64)}px`] : []),
      "minmax(44px, max-content)",
    ]),
  ].join(" ");

  const cellState = (binding: string, i: number): Cell => {
    const expected = c.steps[i]!.expect.includes(binding);
    const r = result?.steps[i];
    if (!r) return expected ? "expect" : "idle";
    if (r.fired.includes(binding)) return expected ? "hit" : "extra";
    return expected ? "miss" : "idle";
  };

  const report = () => {
    copy(
      [
        `### ${c.title} (\`${c.id}\`)`,
        "",
        `- Status: ${status.toUpperCase()}`,
        `- Platform: ${navigator.userAgent}`,
        `- Bindings: ${bindings.map(([b]) => `\`${b}\``).join(", ")}`,
        ...(result?.error ? [`- Error: ${result.error}`] : []),
        ...failed.map((f) => `- Step ${f.step} failed: ${f.label}`),
      ].join("\n"),
    );
  };

  const failed = (result?.steps ?? []).flatMap((s, i) =>
    s.checks.filter((k) => !k.pass).map((k) => ({ step: i + 1, label: k.label })),
  );
  const picked = sel !== null ? c.steps[sel] : undefined;

  return (
    <article id={c.id} className="strip" data-status={status}>
      <header className="strip-head">
        <h3>
          <a href={`#${c.id}`}>{c.title}</a>
        </h3>
        {c.tags.map((tag) => (
          <span key={tag} className="tag">
            {tag}
          </span>
        ))}
        <span className="strip-spacer" />
        <button className="tape-btn" onClick={report} aria-label={`Copy report for ${c.title}`}>
          {copied ? "Copied" : "Report"}
        </button>
        {c.steps.length > 0 && (
          <button className="tape-btn" onClick={play} aria-label={`Play ${c.title}`}>
            ▶
          </button>
        )}
        <span className="stamp" data-status={status} aria-label={status}>
          {status === "running" ? "…" : status === "pass" ? "✓" : "✗ fail"}
        </span>
      </header>
      <p className="strip-desc">{inlineCode(c.description)}</p>

      {c.throws || result?.error !== undefined ? (
        <div className="throws" data-pass={result?.errorPass}>
          <span className="dim">throws</span> <code>{result?.error ?? String(c.throws)}</code>
          {result?.error !== undefined && c.throws && (
            <span className="dim">
              {" "}
              · expected <code>{String(c.throws)}</code>
            </span>
          )}
        </div>
      ) : (
        <div className="roll" style={{ gridTemplateColumns: gridCols }} role="table">
          {/* ruler: the presses */}
          <div className="roll-label dim">press</div>
          {c.steps.flatMap((s, i) => [
            ...(s.press.wait
              ? [
                  <div key={`g${i}`} className="roll-gap" data-wait>
                    <span>{s.press.wait}ms</span>
                  </div>,
                ]
              : []),
            <button
              key={i}
              className="roll-press"
              data-head={head === i}
              data-ahead={head >= 0 && i > head}
              aria-pressed={sel === i}
              aria-label={`Step ${i + 1}: ${pressCaps(s.press, apple).join(" ")}`}
              onClick={() => setSel(sel === i ? null : i)}
            >
              <span className="kbd-row">
                {pressCaps(s.press, apple).map((cap, j) => (
                  <Kbd key={j} active={head === i}>
                    {cap}
                  </Kbd>
                ))}
              </span>
              <span className="roll-meta">
                {s.press.type === "keyup" ? "up" : i + 1}
                {s.press.repeat ? " ↻" : ""}
                {s.press.composing ? " ime" : ""}
                {s.press.on && s.press.on !== "host" ? ` <${s.press.on}>` : ""}
              </span>
            </button>,
          ])}

          {/* one track per binding */}
          {bindings.flatMap(([binding, config]) => {
            let valid = true;
            try {
              parseKeybinding(binding);
            } catch {
              valid = false;
            }
            const opts = Object.entries(config)
              .map(([k, v]) => (typeof v === "function" ? k : `${k}: ${String(v)}`))
              .join(", ");
            return [
              <div key={`l${binding}`} className="roll-label">
                {valid ? (
                  <Binding binding={binding} apple={apple} />
                ) : (
                  <code className="fail-text">{JSON.stringify(binding)}</code>
                )}
                {opts && <span className="roll-opts">{opts}</span>}
              </div>,
              ...c.steps.flatMap((s, i) => [
                ...(s.press.wait ? [<div key={`${binding}g${i}`} className="roll-gap" />] : []),
                <div
                  key={`${binding}${i}`}
                  className="roll-cell"
                  data-state={cellState(binding, i)}
                  data-head={head === i}
                  data-ahead={head >= 0 && i > head}
                >
                  <i />
                </div>,
              ]),
            ];
          })}

          {hasFlags && [
            <div key="fl" className="roll-label dim">
              flags
            </div>,
            ...c.steps.flatMap((s, i) => {
              const r = result?.steps[i];
              const flag = (name: string, want: boolean | undefined, got: boolean | undefined) =>
                want === undefined ? null : (
                  <span key={name} data-ok={r ? want === got : undefined}>
                    {want ? name : `¬${name}`}
                  </span>
                );
              return [
                ...(s.press.wait ? [<div key={`fg${i}`} className="roll-gap" />] : []),
                <div key={`f${i}`} className="roll-flags" data-ahead={head >= 0 && i > head}>
                  {flag("pd", s.prevented, r?.prevented)}
                  {flag("stop", s.stopped, r?.stopped)}
                  {r?.conflicts.map((b) => (
                    <span key={b} title={`conflict: “${b}” yielded`}>
                      ↷
                    </span>
                  ))}
                </div>,
              ];
            }),
          ]}
        </div>
      )}

      {picked && (
        <pre className="event">
          {JSON.stringify(
            {
              type: picked.press.type ?? "keydown",
              ...toEventInit(picked.press),
              dispatchedOn: picked.press.on ?? "host",
            },
            (_k, v) => (v === false ? undefined : v),
          )}
        </pre>
      )}

      {failed.length > 0 && (
        <ul className="why">
          {failed.map((f, i) => (
            <li key={i}>
              <span className="dim">step {f.step}</span> {f.label}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
