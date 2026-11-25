import { describe, expect, it } from "vitest";
import { NOPE_GONE_SAY, NOPE_LABELS, nextDodge, nopePose } from "./StartScreen.tsx";

describe("nextDodge (말래 버튼 도망)", () => {
  const home = { left: 560, top: 300, right: 680, bottom: 352 }; // 120×52 버튼
  const go = { left: 400, top: 300, right: 540, bottom: 352 }; // 쓸래 버튼
  const seeded = () => {
    let seed = 7;
    return () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
  };

  it("화면 안 먼 곳으로 점프한다 (짧은 변의 40% 이상)", () => {
    const rand = seeded();
    let pos = { x: 0, y: 0 };
    for (let i = 0; i < 30; i++) {
      const next = nextDodge(home, 1280, 800, pos, go, rand);
      expect(Math.hypot(next.x - pos.x, next.y - pos.y)).toBeGreaterThanOrEqual(320);
      pos = next;
    }
  });

  it("화면 밖으로 나가지 않고 쓸래 버튼을 가리지 않는다 (휴대폰 폭)", () => {
    const phoneHome = { left: 200, top: 500, right: 320, bottom: 552 };
    const phoneGo = { left: 60, top: 500, right: 190, bottom: 552 };
    const rand = seeded();
    let pos = { x: 0, y: 0 };
    for (let i = 0; i < 30; i++) {
      pos = nextDodge(phoneHome, 390, 844, pos, phoneGo, rand);
      const left = phoneHome.left + pos.x;
      const top = phoneHome.top + pos.y;
      expect(left).toBeGreaterThanOrEqual(12);
      expect(left + 120).toBeLessThanOrEqual(390 - 12);
      expect(top).toBeGreaterThanOrEqual(12);
      expect(top + 52).toBeLessThanOrEqual(844 - 12);
      const overlaps =
        left < phoneGo.right &&
        left + 120 > phoneGo.left &&
        top < phoneGo.bottom &&
        top + 52 > phoneGo.top;
      expect(overlaps).toBe(false);
    }
  });

  it("말래 문구에는 항복이 없다 (눌러 주는 문구가 없음)", () => {
    expect(NOPE_LABELS.length).toBe(5);
    expect(NOPE_LABELS.some((l) => l.includes("알겠어"))).toBe(false);
    expect(NOPE_GONE_SAY.join(" ")).toBe("당신은 이 웹을 무조건 써야 합니다 ㅋ");
  });

  it("쫓을수록 쓸말이가 격해지다가 말래가 사라지면 만세", () => {
    expect([0, 1, 2, 3, 4, 5].map(nopePose)).toEqual([
      "idle",
      "unsure",
      "unsure",
      "sharp",
      "clip",
      "intune",
    ]);
  });
});
