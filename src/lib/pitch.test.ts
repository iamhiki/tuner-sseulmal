import { describe, expect, it } from "vitest";
import { nearestNote, noteFromName } from "./notes.ts";
import { createPitchDetector } from "./pitch.ts";

const SAMPLE_RATE = 44100;
const LEN = 8192; // matches the app's capture window

/**
 * A plucked-string-like signal: a stack of harmonics with 1/h amplitude decay,
 * scaled to a comfortable level well above the RMS gate.
 */
function tone(freq: number, harmonics = 6, amp = 0.5): Float32Array {
  const buf = new Float32Array(LEN);
  for (let i = 0; i < LEN; i++) {
    let s = 0;
    for (let h = 1; h <= harmonics; h++) {
      if (h * freq >= SAMPLE_RATE / 2) break;
      s += (1 / h) * Math.sin((2 * Math.PI * h * freq * i) / SAMPLE_RATE);
    }
    buf[i] = amp * s;
  }
  return buf;
}

function centsError(detected: number, expected: number): number {
  return 1200 * Math.log2(detected / expected);
}

describe("createPitchDetector.detect", () => {
  const cases: Array<{ note: string; minFreq: number; maxFreq: number; tol: number }> = [
    { note: "E2", minFreq: 55, maxFreq: 700, tol: 8 }, // guitar low E
    { note: "A2", minFreq: 55, maxFreq: 700, tol: 8 },
    { note: "E4", minFreq: 55, maxFreq: 700, tol: 8 }, // guitar high E
    { note: "A4", minFreq: 130, maxFreq: 900, tol: 8 }, // ukulele
    { note: "E1", minFreq: 28, maxFreq: 450, tol: 15 }, // bass low E (coarse bins)
    { note: "A1", minFreq: 28, maxFreq: 450, tol: 12 },
  ];

  for (const { note, minFreq, maxFreq, tol } of cases) {
    it(`locks onto ${note} within ${tol} cents`, () => {
      const expected = noteFromName(note).freq;
      const det = createPitchDetector({ minFreq, maxFreq });
      const result = det.detect(tone(expected), SAMPLE_RATE);

      // Right note in the right octave (no octave error).
      const near = nearestNote(result.freq);
      expect(`${near.note.name}${near.note.octave}`).toBe(note);
      // And precise.
      expect(Math.abs(centsError(result.freq, expected))).toBeLessThan(tol);
      expect(result.clarity).toBeGreaterThan(0.8);
    });
  }

  it("returns no pitch for silence", () => {
    const det = createPitchDetector({ minFreq: 55, maxFreq: 700 });
    const result = det.detect(new Float32Array(LEN), SAMPLE_RATE);
    expect(result.freq).toBe(-1);
  });

  it("returns no pitch for sub-threshold noise", () => {
    const det = createPitchDetector({ minFreq: 55, maxFreq: 700 });
    const buf = tone(110, 6, 0.001); // below RMS_THRESHOLD
    const result = det.detect(buf, SAMPLE_RATE);
    expect(result.freq).toBe(-1);
    // 튜너쓸말: 레벨 미터용으로 측정한 RMS는 유지한다.
    expect(result.rms).toBeGreaterThan(0);
    // 결과 객체는 매번 새로 만들어져 호출자 변경이 다음 결과에 새지 않는다.
    result.freq = 440;
    expect(det.detect(buf, SAMPLE_RATE).freq).toBe(-1);
  });

  it("keeps a decaying bass E1 whose fundamental is weaker than its 2nd harmonic", () => {
    // 실측(오인페 입력 2, 4번줄 꼬리 -28 dB 이하)을 흉내 낸다: 기본음이 2배음보다
    // 약 -20 dB 작아 반주기 YIN 골이 임계값 아래로 먼저 내려온다.
    const f = noteFromName("E1").freq;
    for (const [a1, a3] of [
      [0.1, 0.3],
      [0.08, 0.25],
      [0.05, 0.2],
    ]) {
      const amps = [a1, 1, a3, 0.35, 0.1];
      const buf = new Float32Array(LEN);
      for (let i = 0; i < LEN; i++) {
        let s = 0;
        for (let h = 0; h < amps.length; h++)
          s += amps[h] * Math.sin((2 * Math.PI * (h + 1) * f * i) / SAMPLE_RATE + h);
        buf[i] = 0.05 * s;
      }
      const result = createPitchDetector({ minFreq: 28, maxFreq: 450 }).detect(buf, SAMPLE_RATE);
      expect(Math.abs(centsError(result.freq, f))).toBeLessThan(15);
    }
  });

  it("does not drop a strong low E down an octave", () => {
    // A clean E2 with a present fundamental must not be reported as E1.
    const det = createPitchDetector({ minFreq: 55, maxFreq: 700 });
    const result = det.detect(tone(noteFromName("E2").freq), SAMPLE_RATE);
    expect(nearestNote(result.freq).note.octave).toBe(2);
  });
});
