import { describe, expect, it } from "vitest";
import { LevelTracker, levelToBar, measure } from "./inputLevel.ts";

const sine = (amp: number, n = 2048) =>
  Float32Array.from({ length: n }, (_, i) => amp * Math.sin((2 * Math.PI * 55 * i) / 48000));

describe("levelToBar", () => {
  it("구역 경계가 화면 구역(25% · 80%)과 맞는다", () => {
    expect(levelToBar(-Infinity)).toBe(0);
    expect(levelToBar(-60)).toBe(0);
    expect(levelToBar(-18)).toBeCloseTo(0.25);
    expect(levelToBar(-1)).toBeCloseTo(0.8);
    expect(levelToBar(0)).toBeCloseTo(1);
  });
});

describe("LevelTracker", () => {
  it("무음은 신호 없음", () => {
    const t = new LevelTracker();
    expect(t.update(new Float32Array(2048), 0).state).toBe("none");
  });

  it("피크 -30 dBFS는 너무 작음", () => {
    const t = new LevelTracker();
    const r = t.update(sine(10 ** (-30 / 20)), 0);
    expect(r.peakDb).toBeCloseTo(-30, 0);
    expect(r.state).toBe("low");
  });

  it("피크 -10 dBFS는 적정", () => {
    expect(new LevelTracker().update(sine(10 ** (-10 / 20)), 0).state).toBe("good");
  });

  it("풀스케일은 클리핑, 1.5초 동안 유지 후 풀린다", () => {
    const t = new LevelTracker();
    expect(t.update(sine(1), 0).state).toBe("clip");
    expect(t.update(sine(0.3), 1000).state).toBe("clip");
    expect(t.update(sine(0.3), 3000).state).toBe("good");
    expect(t.update(sine(0.3), 3000).clipCount).toBe(1);
  });

  it("세게 친 뒤 2초 동안 피크를 기억한다", () => {
    const t = new LevelTracker();
    t.update(sine(0.3), 0);
    expect(t.update(sine(0.003), 500).state).toBe("good");
    expect(t.update(sine(0.003), 2600).state).toBe("low");
  });

  it("measure는 RMS와 피크를 돌려준다", () => {
    const { rms, peak } = measure(Float32Array.from([1, -1, 1, -1]));
    expect(rms).toBe(1);
    expect(peak).toBe(1);
  });
});
