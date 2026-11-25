import { describe, expect, it } from "vitest";
import { StabilityGate } from "./stabilityGate.ts";

const D2 = 73.42;
const G2 = 98.0;

const run = (g: StabilityGate, frames: number[]) => frames.map((f) => g.update(f));
const repeat = (f: number, n: number) => Array.from({ length: n }, () => f);

describe("StabilityGate", () => {
  it("hides the D2 attack spike from the A string (실측 108~111 Hz)", () => {
    const g = new StabilityGate();
    const out = run(g, [110.2, 108.4, 111.0, D2 + 0.4, 109.5, ...repeat(D2, 30)]);
    // 공격음 5프레임 + D2가 확정되기 전 4프레임은 모두 -1 (분석 중)
    expect(out.slice(0, 9)).toEqual(repeat(-1, 9));
    expect(out.slice(9)).toEqual(repeat(D2, 26));
  });

  it("hides the G2 attack spike (실측 68 Hz)", () => {
    const g = new StabilityGate();
    const out = run(g, [68.1, ...repeat(G2, 30)]);
    expect(out.slice(0, 5)).toEqual(repeat(-1, 5));
    expect(out.slice(5)).toEqual(repeat(G2, 26));
  });

  it("shows a clean note after minFrames (≈0.08 s at 60 fps)", () => {
    const g = new StabilityGate({ minFrames: 5 });
    const out = run(g, repeat(D2, 6));
    expect(out.slice(0, 4)).toEqual([-1, -1, -1, -1]);
    expect(out[4]).toBe(D2);
    expect(g.state).toBe("stable");
  });

  it("holds the last stable value through a short outlier mid-note", () => {
    const g = new StabilityGate();
    run(g, repeat(D2, 10));
    expect(g.update(110)).toBe(D2);
    expect(g.state).toBe("holding");
    expect(g.update(D2)).toBe(D2);
    expect(g.state).toBe("stable");
  });

  it("follows slow tuning changes without delay", () => {
    const g = new StabilityGate();
    run(g, repeat(G2, 10));
    let f = G2;
    for (let i = 0; i < 40; i++) {
      f *= 2 ** (3 / 1200); // 프레임마다 +3¢
      expect(g.update(f)).toBe(f);
    }
  });

  it("switches to a genuinely new note after minFrames", () => {
    const g = new StabilityGate({ minFrames: 5 });
    run(g, repeat(41.2, 10));
    const out = run(g, repeat(55, 5));
    expect(out.slice(0, 4)).toEqual(repeat(41.2, 4));
    expect(out[4]).toBe(55);
  });

  it("drops to -1 when readings keep disagreeing", () => {
    const g = new StabilityGate({ maxHoldFrames: 3 });
    run(g, repeat(D2, 10));
    const out = run(g, [110, 60, 120, 50, 130]);
    expect(out).toEqual([D2, D2, D2, -1, -1]);
    expect(g.state).toBe("unstable"); // 처음 분석 중(pending)과 구분
  });

  it("does not confirm a run that keeps drifting (each step small, total large)", () => {
    const g = new StabilityGate({ minFrames: 5, toleranceCents: 50 });
    let f = 100;
    const out: number[] = [];
    for (let i = 0; i < 10; i++) {
      out.push(g.update(f));
      f *= 2 ** (20 / 1200); // 프레임마다 +20¢, 5프레임이면 +80¢
    }
    expect(out).toEqual(repeat(-1, 10));
  });

  it("treats readings exactly at the tolerance (or zero tolerance) as the same note", () => {
    const g0 = new StabilityGate({ minFrames: 3, toleranceCents: 0 });
    expect(run(g0, repeat(G2, 3))).toEqual([-1, -1, G2]);
    const g = new StabilityGate({ minFrames: 2, toleranceCents: 50 });
    const edge = G2 * 2 ** (50 / 1200);
    expect(run(g, [G2, edge])).toEqual([-1, edge]);
  });

  it("resets on silence", () => {
    const g = new StabilityGate();
    run(g, repeat(D2, 10));
    expect(g.update(-1)).toBe(-1);
    expect(g.state).toBe("idle");
    expect(g.update(D2)).toBe(-1);
  });
});
