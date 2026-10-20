// Compares the built microkeys bundle against upstream tinykeys.
// Run with `npm run bench` (builds first).
import { Window } from "happy-dom";
import { Bench } from "tinybench";

globalThis.KeyboardEvent = new Window().KeyboardEvent;
console.warn = () => {}; // silence tinykeys conflict warnings

const { createKeybindingsHandler: microHandler } = await import("../dist/index.js");
const { createKeybindingsHandler: tinyHandler } = await import("tinykeys");

// 104 realistic bindings: single keys, modifiers, $mod, and sequences.
const map = {};
for (const k of "abcdefghijklmnopqrstuvwxyz") {
  map[k] = () => {};
  map[`Shift+${k}`] = () => {};
  map[`$mod+${k}`] = () => {};
  map[`g ${k}`] = () => {};
}

const events = [
  new KeyboardEvent("keydown", { key: "z", code: "KeyZ" }),
  new KeyboardEvent("keydown", { key: "Z", code: "KeyZ", shiftKey: true }),
  new KeyboardEvent("keydown", { key: "g", code: "KeyG" }),
  new KeyboardEvent("keydown", { key: "1", code: "Digit1" }),
];

const micro = microHandler(map, { onConflict: false });
const tiny = tinyHandler(map);

const dispatch = new Bench({ name: "dispatch 4 events over 104 bindings", time: 500 });
dispatch
  .add("microkeys", () => {
    for (const e of events) micro(e);
  })
  .add("tinykeys", () => {
    for (const e of events) tiny(e);
  });

const create = new Bench({ name: "parse + create handler (104 bindings)", time: 500 });
create
  .add("microkeys", () => microHandler(map, { onConflict: false }))
  .add("tinykeys", () => tinyHandler(map));

for (const bench of [dispatch, create]) {
  await bench.run();
  console.log(`\n${bench.name}`);
  console.table(bench.table());
}

// tinykeys schedules a setTimeout per event; let the process exit.
process.exit(0);
