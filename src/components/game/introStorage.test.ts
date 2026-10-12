import { describe, expect, it } from "vitest";
import type { KeyValueStore } from "@/lib/storage";
import { forgetIntro, introSeen, markIntroSeen } from "./introStorage";

function memory(): KeyValueStore {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) };
}

describe("intro storage", () => {
  it("is unseen at first, remembered per level once marked, and forgotten on request", () => {
    const store = memory();
    expect(introSeen("act1-01", store)).toBe(false);
    markIntroSeen("act1-01", store);
    expect(introSeen("act1-01", store)).toBe(true);
    expect(introSeen("act1-02", store)).toBe(false);
    markIntroSeen("act1-02", store);
    forgetIntro("act1-01", store);
    expect(introSeen("act1-01", store)).toBe(false);
    expect(introSeen("act1-02", store)).toBe(true);
  });

  it("ignores stored text that is not a list of ids", () => {
    const store: KeyValueStore = { getItem: () => "{broken", setItem: () => {} };
    expect(introSeen("act1-01", store)).toBe(false);
  });

  it("is remembered for the page view when storage refuses writes", () => {
    const store: KeyValueStore = {
      getItem: () => null,
      setItem: () => {
        throw new Error("blocked");
      },
    };
    markIntroSeen("act1-01", store);
    expect(introSeen("act1-01", store)).toBe(true);
  });
});
