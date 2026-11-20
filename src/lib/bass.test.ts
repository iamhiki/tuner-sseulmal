import { describe, expect, it } from "vitest";
import { BASS_RANGE, bassTuning } from "./bass.ts";

describe("bassTuning", () => {
  it("resolves 4-string standard tuning to the planned target frequencies", () => {
    const got = bassTuning.strings.map((n) => [`${n.name}${n.octave}`, Number(n.freq.toFixed(2))]);
    expect(got).toEqual([
      ["E1", 41.2],
      ["A1", 55],
      ["D2", 73.42],
      ["G2", 98],
    ]);
  });

  it("keeps every target inside the detection range", () => {
    for (const n of bassTuning.strings) {
      expect(n.freq).toBeGreaterThan(BASS_RANGE.min);
      expect(n.freq).toBeLessThan(BASS_RANGE.max);
    }
  });
});
