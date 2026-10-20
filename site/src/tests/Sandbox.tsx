import {
  defaultKeybindingsHandlerIgnore,
  eventModifiers,
  microkeys,
  parseKeybinding,
} from "microkeys";
import { useEffect, useMemo, useRef, useState } from "react";
import { Binding } from "../ui";

const DEFAULT = ["$mod+k", "g i", "Shift+?", "(F[1-9])", "[Shift]+ArrowDown", "Hyper+x"].join("\n");

interface LogEntry {
  id: number;
  key: string;
  code: string;
  mods: string;
  repeat: boolean;
  fired: string[];
}

const MOD_NAMES: [number, string][] = [
  [8, "Ctrl"],
  [4, "Alt"],
  [1, "Shift"],
  [2, "Meta"],
  [16, "AltGr"],
];

export function Sandbox({ apple }: { apple: boolean }) {
  const [text, setText] = useState(DEFAULT);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [prevent, setPrevent] = useState(true);
  const firedRef = useRef<string[]>([]);
  const nextId = useRef(0);

  const lines = useMemo(
    () =>
      text
        .split("\n")
        .filter((line) => line.trim())
        .map((line) => {
          try {
            parseKeybinding(line);
            return { line, error: null };
          } catch (error) {
            return {
              line,
              error: (error as Error).message.replace("microkeys: ", ""),
            };
          }
        }),
    [text],
  );

  useEffect(() => {
    const valid = [...new Set(lines.filter((l) => !l.error).map((l) => l.line))];
    const off = microkeys(
      window,
      Object.fromEntries(
        valid.map((line) => [
          line,
          (_e: KeyboardEvent, { binding }: { binding: string }) => firedRef.current.push(binding),
        ]),
      ),
      { preventDefault: prevent, onConflict: false },
    );
    // Registered after microkeys, so it sees what fired for this event.
    const onKey = (event: KeyboardEvent) => {
      if (defaultKeybindingsHandlerIgnore(event)) return;
      const mask = eventModifiers(event);
      const entry: LogEntry = {
        id: nextId.current++,
        key: event.key === " " ? "Space" : event.key,
        code: event.code,
        mods: MOD_NAMES.filter(([bit]) => mask & bit)
          .map(([, name]) => name)
          .join("+"),
        repeat: event.repeat,
        fired: firedRef.current,
      };
      firedRef.current = [];
      setLog((log) => [entry, ...log].slice(0, 14));
    };
    window.addEventListener("keydown", onKey);
    return () => {
      off();
      window.removeEventListener("keydown", onKey);
    };
  }, [lines, prevent]);

  return (
    <div className="case">
      <div className="case-head">
        <h1>Sandbox</h1>
        <span className="chip">LIVE</span>
      </div>
      <p className="case-desc">
        One binding per line. Click outside the editor, then press keys: each event is logged with
        the bindings it fired.
      </p>

      <div className="sandbox">
        <div className="sandbox-col">
          <textarea
            className="sandbox-editor"
            spellCheck={false}
            aria-label="Bindings, one per line"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
          />
          <ul className="sandbox-parsed">
            {lines.map(({ line, error }, i) => (
              <li key={i} data-error={!!error}>
                {error ? (
                  <span className="fail-text">{error}</span>
                ) : (
                  <Binding binding={line} apple={apple} />
                )}
              </li>
            ))}
          </ul>
          <label className="toggle">
            <input
              type="checkbox"
              checked={prevent}
              onChange={(e) => setPrevent(e.target.checked)}
            />
            preventDefault on match
          </label>
        </div>

        <div className="sandbox-col">
          <table className="table log">
            <thead>
              <tr>
                <th>key</th>
                <th>code</th>
                <th>mods</th>
                <th>fired</th>
              </tr>
            </thead>
            <tbody>
              {log.length === 0 && (
                <tr>
                  <td colSpan={4} className="dim">
                    Press a key…
                  </td>
                </tr>
              )}
              {log.map((entry) => (
                <tr key={entry.id} data-fired={entry.fired.length > 0}>
                  <td>
                    <code>{entry.key}</code>
                    {entry.repeat && <span className="dim"> ↻</span>}
                  </td>
                  <td>
                    <code>{entry.code}</code>
                  </td>
                  <td>{entry.mods || <span className="dim">—</span>}</td>
                  <td>
                    {entry.fired.length ? (
                      <code className="pass-text">{entry.fired.join(", ")}</code>
                    ) : (
                      <span className="dim">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
