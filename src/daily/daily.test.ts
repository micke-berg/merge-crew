import { describe, expect, it } from "vitest";
import { everyLevel as levels, incidents } from "@/levels";
import {
  DAILY_POOL,
  FIRST_DAY,
  NO_RECORD,
  currentStreak,
  dayNumber,
  incidentId,
  incidentLevel,
  parseBeat,
  parseRecord,
  recordSolve,
  roundOrder,
  shareText,
} from "./daily";

describe("the pool", () => {
  it("has every incident made for the daily", () => {
    expect(incidents.length).toBeGreaterThanOrEqual(6);
    for (const i of incidents) expect(DAILY_POOL).toContain(i.id);
    expect(DAILY_POOL.length).toBeGreaterThanOrEqual(12);
  });

  it("holds levels with a par and without rule cards", () => {
    expect(DAILY_POOL.length).toBeGreaterThanOrEqual(5);
    for (const id of DAILY_POOL) {
      const level = levels.find((l) => l.id === id)!;
      expect(level.par).toBeGreaterThan(0);
      expect(level.shift).toBeUndefined();
    }
  });
});

describe("dayNumber", () => {
  it("is 1 on the first day and counts whole UTC days", () => {
    expect(dayNumber(FIRST_DAY)).toBe(1);
    expect(dayNumber(FIRST_DAY + 86_399_999)).toBe(1);
    expect(dayNumber(FIRST_DAY + 86_400_000)).toBe(2);
    expect(dayNumber(new Date(Date.UTC(2026, 10, 21, 12)))).toBe(11);
    expect(dayNumber(FIRST_DAY - 1)).toBe(0);
  });
});

describe("incidentId", () => {
  it("is the same for everyone, and plays the whole pool once per round", () => {
    const n = DAILY_POOL.length;
    for (const round of [0, 1, 2, 7]) {
      const ids = Array.from({ length: n }, (_, i) => incidentId(round * n + i + 1));
      expect([...ids].sort()).toEqual([...DAILY_POOL].sort());
      expect(ids).toEqual(roundOrder(round));
    }
  });

  it("never plays the same incident two days in a row", () => {
    for (let day = 1; day < DAILY_POOL.length * 40; day++) expect(incidentId(day + 1), `day ${day}`).not.toBe(incidentId(day));
  });

  it("shuffles each round differently", () => {
    const rounds = [0, 1, 2, 3, 4].map((r) => roundOrder(r).join(","));
    expect(new Set(rounds).size).toBeGreaterThan(1);
  });

  it("has nothing before day 1 or for an empty pool", () => {
    expect(incidentId(0)).toBeNull();
    expect(incidentId(3, [])).toBeNull();
    expect(incidentLevel(1)?.id).toBe(incidentId(1));
  });
});

describe("the streak", () => {
  const r = (moves: number, hints = 0) => ({ moves, hints });

  it("grows on consecutive days and starts over after a missed day", () => {
    let rec = recordSolve(NO_RECORD, 5, r(4));
    expect(rec).toMatchObject({ last: 5, streak: 1, best: 1 });
    rec = recordSolve(rec, 6, r(3));
    rec = recordSolve(rec, 7, r(3));
    expect(rec).toMatchObject({ last: 7, streak: 3, best: 3 });
    rec = recordSolve(rec, 9, r(3));
    expect(rec).toMatchObject({ last: 9, streak: 1, best: 3 });
  });

  it("keeps the better result when a day is solved again, and does not count it twice", () => {
    let rec = recordSolve(NO_RECORD, 5, r(6, 2));
    rec = recordSolve(rec, 5, r(4, 1));
    expect(rec.results["5"]).toEqual(r(4, 1));
    expect(rec.streak).toBe(1);
    expect(recordSolve(rec, 5, r(9)).results["5"]).toEqual(r(4, 1));
    expect(recordSolve(rec, 5, r(4, 0)).results["5"]).toEqual(r(4, 0));
  });

  it("is still alive today and tomorrow, and gone the day after", () => {
    const rec = recordSolve(recordSolve(NO_RECORD, 5, r(4)), 6, r(4));
    expect(currentStreak(rec, 6)).toBe(2);
    expect(currentStreak(rec, 7)).toBe(2);
    expect(currentStreak(rec, 8)).toBe(0);
  });

  it("reads a stored record back, and survives rubbish", () => {
    const rec = recordSolve(NO_RECORD, 5, r(4, 1));
    expect(parseRecord(JSON.stringify(rec))).toEqual(rec);
    for (const raw of [null, "", "nope", "[]", "42", '{"last":"x","results":{"a":1,"3":{"moves":-2}}}']) {
      const read = parseRecord(raw);
      expect(read.last).toBe(0);
      expect(read.streak).toBe(0);
    }
    expect(parseRecord('{"results":{"3":{"moves":-2}}}').results["3"]).toEqual({ moves: 0, hints: 0 });
  });
});

describe("shareText", () => {
  it("says the number, the title, the count against par and the hints, and nothing of the answer", () => {
    expect(shareText({ number: 12, title: "Blaze was in a hurry", moves: 4, par: 3, hints: 0, url: "https://example.test/daily" })).toBe(
      "Merge Crew #12 · Blaze was in a hurry · 4 commands (par 3) · no hints\nhttps://example.test/daily",
    );
    expect(shareText({ title: "House rules", moves: 1, hints: 1, url: "u" })).toBe("Merge Crew · House rules · 1 command · 1 hint\nu");
    expect(shareText({ title: "T", moves: 2, par: 2, hints: 3, url: "u" })).not.toMatch(/git /);
  });
});

describe("parseBeat", () => {
  it("accepts a small whole number and nothing else", () => {
    expect(parseBeat("4")).toBe(4);
    expect(parseBeat("120")).toBe(120);
    for (const bad of [null, undefined, "", "0", "-1", "4.5", "abc", "1e3", "9999", " 4"]) expect(parseBeat(bad)).toBeNull();
  });
});
