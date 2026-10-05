import { describe, expect, it } from "vitest";
import type { KeyValueStore } from "@/lib/storage";
import { markPremiseSeen, premiseSeen } from "./premiseStorage";

function memory(): KeyValueStore {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) };
}

describe("premise storage", () => {
  it("is unseen on a first visit and remembered once marked", () => {
    const store = memory();
    expect(premiseSeen(store)).toBe(false);
    markPremiseSeen(store);
    expect(premiseSeen(store)).toBe(true);
  });

  it("is remembered for the page view when storage refuses writes", () => {
    const store: KeyValueStore = {
      getItem: () => null,
      setItem: () => {
        throw new Error("blocked");
      },
    };
    markPremiseSeen(store);
    expect(premiseSeen(store)).toBe(true);
  });
});
