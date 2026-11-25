import { describe, expect, it } from "vitest";
import { OctaveHold } from "./octaveHold.ts";

const E1 = 41.2;

/** 실측 4번줄 흐름: 치는 순간 E1, 레벨이 줄며 -28 dB 아래에서 검출값이 E2(2배)로 튐. */
function decayingE1(): Array<[number, number]> {
  const frames: Array<[number, number]> = [];
  let rms = 0.4;
  for (let i = 0; i < 200; i++) {
    frames.push([i < 80 ? E1 : 2 * E1 + 0.05, rms]);
    rms *= 0.98;
  }
  return frames;
}

describe("OctaveHold", () => {
  it("keeps E1 when a decaying string's reading jumps to exactly 2×", () => {
    const h = new OctaveHold();
    for (const [f, rms] of decayingE1()) expect(h.update(f, rms)).toBeCloseTo(E1, 0);
  });

  it("releases on a new pluck (level jump) so a real octave-up note shows", () => {
    const h = new OctaveHold();
    for (const [f, rms] of decayingE1()) h.update(f, rms);
    expect(h.update(2 * E1, 0.4)).toBeCloseTo(2 * E1, 1);
  });

  it("releases when the signal drops out", () => {
    const h = new OctaveHold();
    h.update(E1, 0.1);
    expect(h.update(-1, 0.001)).toBe(-1);
    expect(h.update(2 * E1, 0.05)).toBeCloseTo(2 * E1, 1);
  });

  it("leaves non-octave changes alone", () => {
    const h = new OctaveHold();
    h.update(55, 0.1);
    expect(h.update(73.42, 0.09)).toBe(73.42); // 다른 줄
    expect(h.update(73.42 * 1.01, 0.08)).toBeCloseTo(73.42 * 1.01, 5); // 튜닝 조정
  });

  it("does not lock onto a single octave-down misread", () => {
    // 실기: 98 Hz를 울리는 중 검출기가 1프레임만 49 Hz로 읽음 → 뒤의 98 Hz가 반으로 깎이면 안 된다
    const h = new OctaveHold();
    for (let i = 0; i < 40; i++) h.update(98, 0.05);
    expect(h.update(49.05, 0.05)).toBeCloseTo(49.05, 2); // 이 1프레임은 그대로 (뒤의 게이트가 거른다)
    for (let i = 0; i < 30; i++) expect(h.update(98, 0.05)).toBe(98);
  });
});
