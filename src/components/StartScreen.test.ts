import { describe, expect, it } from "vitest";
import { NOPE_GONE_NOTE, NOPE_LABELS, nextDodge } from "./StartScreen.tsx";

const home = { left: 200, top: 300, right: 300, bottom: 352 };

describe("nextDodge (말래 버튼 도망)", () => {
  it("원래 자리에서 70px 넘게 떨어진 곳으로 간다", () => {
    let seed = 1;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let i = 0; i < 50; i++) {
      const p = nextDodge(home, 1280, 800, { x: 0, y: 0 }, rand);
      expect(Math.abs(p.x)).toBeGreaterThanOrEqual(70);
    }
  });

  it("화면 밖으로 나가지 않는다 (좁은 휴대폰 화면)", () => {
    for (const r of [0, 0.25, 0.5, 0.75, 0.999]) {
      const p = nextDodge(home, 320, 640, { x: 0, y: 0 }, () => r);
      expect(home.left + p.x).toBeGreaterThanOrEqual(8);
      expect(home.right + p.x).toBeLessThanOrEqual(312);
      expect(home.top + p.y).toBeGreaterThanOrEqual(8);
      expect(home.bottom + p.y).toBeLessThanOrEqual(632);
    }
  });

  it("말래 문구에는 항복이 없다 (눌러 주는 문구가 없음)", () => {
    expect(NOPE_LABELS.length).toBe(5);
    expect(NOPE_LABELS.some((l) => l.includes("알겠어"))).toBe(false);
    expect(NOPE_GONE_NOTE).toContain("무조건 써야");
  });
});
