import { describe, expect, it } from "vitest";
import { sha1 } from "./hash";

describe("sha1", () => {
  it("matches the standard test vectors", () => {
    expect(sha1("")).toBe("da39a3ee5e6b4b0d3255bfef95601890afd80709");
    expect(sha1("abc")).toBe("a9993e364706816aba3e25717850c26c9cd0d89d");
    expect(sha1("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq")).toBe(
      "84983e441c3bd26ebaae4aa1f95129e5e54670f1",
    );
  });

  it("hashes non-ASCII text as UTF-8", () => {
    expect(sha1("å")).toBe("cfb50dd6cf79fd470f3a558a720777d835bb45de");
  });
});
