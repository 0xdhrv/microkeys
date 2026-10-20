import { expectTypeOf, test } from "vite-plus/test";
import {
  createKeybindingsHandler,
  microkeys,
  type IsValidKeybinding,
  type KeybindingContext,
} from "../src/index";
import { useKeybinding, useKeybindings } from "../src/react";

test("valid keybindings", () => {
  expectTypeOf<IsValidKeybinding<"a">>().toEqualTypeOf<true>();
  expectTypeOf<IsValidKeybinding<"Shift+a">>().toEqualTypeOf<true>();
  expectTypeOf<IsValidKeybinding<"$mod+Shift+K">>().toEqualTypeOf<true>();
  expectTypeOf<IsValidKeybinding<"ctrl+[shift]+a">>().toEqualTypeOf<true>();
  expectTypeOf<IsValidKeybinding<"g i">>().toEqualTypeOf<true>();
  expectTypeOf<IsValidKeybinding<"Shift++">>().toEqualTypeOf<true>();
  expectTypeOf<IsValidKeybinding<"$mod+(F[1-9])">>().toEqualTypeOf<true>();
  expectTypeOf<IsValidKeybinding<"(a+b)">>().toEqualTypeOf<true>();
  expectTypeOf<IsValidKeybinding<string>>().toEqualTypeOf<true>();
});

test("invalid keybindings", () => {
  expectTypeOf<IsValidKeybinding<"Hyper+a">>().toEqualTypeOf<false>();
  expectTypeOf<IsValidKeybinding<"Shift+">>().toEqualTypeOf<false>();
  expectTypeOf<IsValidKeybinding<"g Foo+i">>().toEqualTypeOf<false>();
  expectTypeOf<IsValidKeybinding<"">>().toEqualTypeOf<false>();
});

test("map validation reports the bad binding", () => {
  microkeys(window, { "$mod+k": () => {}, "g i": () => {} });

  microkeys(window, {
    // @ts-expect-error unknown modifier
    "Hyper+a": () => {},
  });

  createKeybindingsHandler({
    // @ts-expect-error empty key
    "Shift+": () => {},
  });
});

test("handler context is typed with the binding", () => {
  microkeys(window, {
    "$mod+s": (event, ctx) => {
      expectTypeOf(event).toEqualTypeOf<KeyboardEvent>();
      expectTypeOf(ctx).toEqualTypeOf<KeybindingContext<"$mod+s">>();
    },
    "g i": {
      handler: (_event, ctx) => {
        expectTypeOf(ctx.binding).toEqualTypeOf<"g i">();
      },
      preventDefault: true,
    },
  });
});

test("react hooks validate bindings", () => {
  useKeybinding("$mod+k", (_event, ctx) => {
    expectTypeOf(ctx.binding).toEqualTypeOf<"$mod+k">();
  });
  // @ts-expect-error unknown modifier
  useKeybinding("Hyper+a", () => {});
  useKeybindings({
    // @ts-expect-error unknown modifier
    "Hyper+a": () => {},
  });
});

test("dynamic maps are accepted", () => {
  const map: Record<string, () => void> = {};
  microkeys(window, map);
});
