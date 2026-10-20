import { microkeys } from "microkeys";
import type { Case, Press, Step, Target } from "./cases";

export interface StepResult {
  step: Step;
  fired: string[];
  prevented: boolean;
  stopped: boolean;
  conflicts: string[];
  /** Human-readable assertion outcomes. */
  checks: { label: string; pass: boolean }[];
  pass: boolean;
}

export interface CaseResult {
  pass: boolean;
  steps: StepResult[];
  error?: string;
  errorPass?: boolean;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function makeTarget(host: HTMLElement, target: Target): HTMLElement {
  if (target === "host") return host;
  const el =
    target === "contenteditable"
      ? Object.assign(document.createElement("div"), {
          contentEditable: "true",
        })
      : document.createElement(target);
  host.append(el);
  return el;
}

export function toEventInit(press: Press): KeyboardEventInit {
  return {
    key: press.key,
    code: press.code,
    shiftKey: !!press.shift,
    ctrlKey: !!press.ctrl,
    altKey: !!press.alt,
    metaKey: !!press.meta,
    modifierAltGraph: !!press.altGraph,
    repeat: !!press.repeat,
    isComposing: !!press.composing,
    bubbles: true,
    cancelable: true,
  } as KeyboardEventInit;
}

const list = (xs: string[]) => (xs.length ? xs.map((x) => `"${x}"`).join(", ") : "nothing");

/**
 * Runs a case against the real library in this browser: a detached-from-view
 * host element listens, and each step dispatches a synthetic KeyboardEvent.
 */
export async function runCase(c: Case): Promise<CaseResult> {
  const sandbox = document.createElement("div");
  sandbox.style.cssText = "position:fixed;left:-9999px;top:0;";
  const host = document.createElement("div");
  sandbox.append(host);
  document.body.append(sandbox);

  let fired: string[] = [];
  let conflicts: string[] = [];
  let bubbled = false;
  // Record bubbling, then contain it: synthetic events must not reach the
  // page's own listeners on window.
  const contain = (event: Event) => {
    bubbled = true;
    event.stopPropagation();
  };
  sandbox.addEventListener("keydown", contain);
  sandbox.addEventListener("keyup", contain);

  const map = Object.fromEntries(
    Object.entries(c.bindings).map(([binding, config]) => [
      binding,
      {
        ...config,
        handler: (_e: KeyboardEvent, ctx: { binding: string }) => fired.push(ctx.binding),
      },
    ]),
  );

  let off: () => void;
  try {
    off = microkeys(host, map, {
      ...c.options,
      onConflict: (binding) => conflicts.push(binding),
    });
  } catch (error) {
    sandbox.remove();
    const message = error instanceof Error ? error.message : String(error);
    const errorPass = !!c.throws?.test(message);
    return { pass: errorPass, steps: [], error: message, errorPass };
  }

  const steps: StepResult[] = [];
  try {
    if (c.throws) {
      return {
        pass: false,
        steps,
        error: "Expected an error, but none was thrown",
        errorPass: false,
      };
    }
    for (const step of c.steps) {
      if (step.press.wait) await sleep(step.press.wait);
      fired = [];
      conflicts = [];
      bubbled = false;
      const target = makeTarget(host, step.press.on ?? "host");
      const event = new KeyboardEvent(step.press.type ?? "keydown", toEventInit(step.press));
      target.dispatchEvent(event);
      if (target !== host) target.remove();

      const checks = [
        {
          label: `fires ${list(step.expect)}${fired.join() !== step.expect.join() ? `, got ${list(fired)}` : ""}`,
          pass: fired.join("\u0000") === step.expect.join("\u0000"),
        },
      ];
      if (step.prevented !== undefined) {
        checks.push({
          label: `defaultPrevented is ${step.prevented}`,
          pass: event.defaultPrevented === step.prevented,
        });
      }
      if (step.stopped !== undefined) {
        checks.push({
          label: step.stopped ? "stops propagation" : "bubbles past host",
          pass: !bubbled === step.stopped,
        });
      }
      steps.push({
        step,
        fired: [...fired],
        prevented: event.defaultPrevented,
        stopped: !bubbled,
        conflicts: [...conflicts],
        checks,
        pass: checks.every((check) => check.pass),
      });
    }
  } finally {
    off();
    sandbox.remove();
  }
  return { pass: steps.every((s) => s.pass), steps };
}
