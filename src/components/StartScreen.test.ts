import { describe, expect, it } from "vitest";
import { NOPE_GONE_SAY, NOPE_LABELS, nextDodge, nopePose, WELCOME_SAYS } from "./StartScreen.tsx";

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
      const next = nextDodge(home, 1280, 800, pos, [go], rand);
      expect(Math.hypot(next.x - pos.x, next.y - pos.y)).toBeGreaterThanOrEqual(320);
      pos = next;
    }
  });

  it("화면 밖으로 나가지 않고 쓸래 버튼·글씨·쓸말이를 가리지 않는다 (휴대폰 폭)", () => {
    const phoneHome = { left: 200, top: 500, right: 320, bottom: 552 };
    const phoneGo = { left: 60, top: 500, right: 190, bottom: 552 };
    const phoneText = { left: 30, top: 120, right: 360, bottom: 480 }; // 쓸말이·제목·안내문
    const rand = seeded();
    let pos = { x: 0, y: 0 };
    for (let i = 0; i < 30; i++) {
      pos = nextDodge(phoneHome, 390, 844, pos, [phoneGo, phoneText], rand);
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
    // 문구를 통째로 고정한다: 바뀌면 "눌러 주겠다"는 뉘앙스가 없는지 사람이 다시 본다.
    expect(NOPE_LABELS).toEqual([
      "말래…",
      "에이, 같이 하자",
      "잠깐만 써보자",
      "쓸래가 더 좋아",
      "한 번만 써줘",
    ]);
    expect(NOPE_GONE_SAY.join(" ")).toBe("말래는 숨었어. 쓸래로 같이 해보자");
    // 환영 멘트: 여러 개, 말풍선 두 줄에 들어가게 덩어리당 짧게
    expect(WELCOME_SAYS.length).toBeGreaterThanOrEqual(6);
    for (const say of WELCOME_SAYS)
      for (const chunk of say) expect(chunk.length).toBeLessThanOrEqual(14);
  });

  it("쫓을수록 쓸말이가 약 오르다가 말래가 사라지면 만세 (떠는 포즈 없음)", () => {
    expect([0, 1, 2, 3, 4, 5].map(nopePose)).toEqual([
      "idle",
      "unsure",
      "unsure",
      "sharp",
      "sharp",
      "intune",
    ]);
  });
});
