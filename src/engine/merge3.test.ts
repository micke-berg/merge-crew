// Expected outputs come from `git merge-file -p -L HEAD -L base -L feature ours base theirs`.

import { describe, expect, it } from "vitest";
import { diffLines, splitLines } from "./diff";
import { mergeFile, mergeTrees } from "./merge3";

const labels = { ours: "HEAD", theirs: "feature" };

describe("splitLines", () => {
  it("keeps newlines and a last line without one", () => {
    expect(splitLines("a\nb")).toEqual(["a\n", "b"]);
    expect(splitLines("")).toEqual([]);
  });
});

describe("diffLines", () => {
  it("reports a replaced line", () => {
    expect(diffLines(["a\n", "b\n", "c\n"], ["a\n", "X\n", "c\n"])).toEqual([{ i1: 1, chg1: 1, i2: 1, chg2: 1 }]);
  });

  it("slides an insertion down the way xdiff does", () => {
    // Inserting a second "x" into "x" is reported after the existing one.
    expect(diffLines(["x\n"], ["x\n", "x\n"])).toEqual([{ i1: 1, chg1: 0, i2: 1, chg2: 1 }]);
  });
});

describe("mergeFile", () => {
  it("merges edits that are apart from each other", () => {
    expect(mergeFile("a\nb\nc\nd\ne\n", "a\nB\nc\nd\ne\n", "a\nb\nc\nD\ne\n", labels)).toEqual({
      clean: true,
      content: "a\nB\nc\nD\ne\n",
    });
  });

  it("treats edits on neighbouring lines as a conflict", () => {
    expect(mergeFile("a\nb\nc\n", "a\nB\nc\n", "a\nb\nC\n", labels)).toEqual({
      clean: false,
      content: "a\n<<<<<<< HEAD\nB\nc\n=======\nb\nC\n>>>>>>> feature\n",
    });
  });

  it("joins conflicts that are three lines or less apart", () => {
    expect(mergeFile("a\nb\nc\nd\ne\n", "a\nX\nc\nY\ne\n", "a\nZ\nc\nW\ne\n", labels).content).toBe(
      "a\n<<<<<<< HEAD\nX\nc\nY\n=======\nZ\nc\nW\n>>>>>>> feature\ne\n",
    );
  });

  it("takes one side's change and conflicts on the overlapping one", () => {
    const base = "1\n2\n3\n4\n5\n6\n7\n8\n9\n";
    expect(mergeFile(base, "1\nF\n3\n4\n5\n6\n7\nF\n9\n", "1\n2\n3\n4\nM\n6\n7\n8\nM\n", labels).content).toBe(
      "1\nF\n3\n4\nM\n6\n7\n<<<<<<< HEAD\nF\n9\n=======\n8\nM\n>>>>>>> feature\n",
    );
  });

  it("picks the same diff as xdiff when several are equally short", () => {
    expect(mergeFile("d\nb\nc\nc\n", "d\nc\nb\nc\n", "d\nb\nc\n", labels).content).toBe(
      "d\nc\n<<<<<<< HEAD\nb\nc\n=======\n>>>>>>> feature\n",
    );
  });

  it("adds a newline inside conflict blocks when a side has none", () => {
    expect(mergeFile("a\nb", "a\nc", "a\nd", labels).content).toBe("a\n<<<<<<< HEAD\nc\n=======\nd\n>>>>>>> feature\n");
  });

  it("merges an add/add pair against an empty base", () => {
    expect(mergeFile("", "one\ntwo\n", "one\nthree\n", labels).content).toBe(
      "one\n<<<<<<< HEAD\ntwo\n=======\nthree\n>>>>>>> feature\n",
    );
  });

  it("does not conflict when both sides made the same change", () => {
    expect(mergeFile("a\nb\nc\n", "a\nX\nc\n", "a\nX\nc\n", labels)).toEqual({ clean: true, content: "a\nX\nc\n" });
  });
});

describe("mergeTrees", () => {
  it("resolves paths changed on one side and reports both kinds of conflict", () => {
    const r = mergeTrees(
      { keep: "k\n", ours: "o\n", theirs: "t\n", both: "b\n", gone: "g\n" },
      { keep: "k\n", ours: "O\n", theirs: "t\n", both: "B1\n", added: "x\n" },
      { keep: "k\n", ours: "o\n", theirs: "T\n", both: "B2\n", gone: "G\n" },
      labels,
    );
    expect(r.merged).toEqual({ keep: "k\n", ours: "O\n", theirs: "T\n", added: "x\n" });
    expect(Object.keys(r.conflicts).sort()).toEqual(["both", "gone"]);
    expect(r.conflicts.gone).toEqual({ base: "g\n", ours: null, theirs: "G\n" });
    expect(r.conflictFiles.gone).toBe("G\n");
    expect(r.conflictFiles.both).toBe("<<<<<<< HEAD\nB1\n=======\nB2\n>>>>>>> feature\n");
  });
});
