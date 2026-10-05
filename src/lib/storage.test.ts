import { describe, expect, it } from "vitest";
import { browserStorage, readItem, writeItem, type KeyValueStore } from "./storage";

const memory = (): KeyValueStore & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
};

const broken = (): KeyValueStore => ({
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("blocked");
  },
});

describe("storage", () => {
  it("reads and writes through a working storage", () => {
    const store = memory();
    expect(readItem("k", store)).toBeNull();
    expect(writeItem("k", "v", store)).toBe(true);
    expect(store.data.get("k")).toBe("v");
    expect(readItem("k", store)).toBe("v");
  });

  it("keeps a refused write in memory for the page view", () => {
    const store = broken();
    expect(readItem("k", store)).toBeNull();
    expect(writeItem("k", "v", store)).toBe(false);
    expect(readItem("k", store)).toBe("v");
    // Another storage does not see it.
    expect(readItem("k", broken())).toBeNull();
  });

  it("has no browser storage on the server", () => {
    expect(browserStorage()).toBeNull();
  });
});
