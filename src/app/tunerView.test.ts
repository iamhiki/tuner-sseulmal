import { describe, expect, it } from "vitest";
import type { PitchReading } from "../audio/pitchPipeline.ts";
import { formatCents, nextInTuneString, rulerPercent, tunerView } from "./tunerView.ts";

const ok = (cents: number): PitchReading => ({
  status: "ok",
  freq: 55,
  note: null,
  stringIndex: 1,
  cents,
});
const none = (status: PitchReading["status"]): PitchReading => ({
  status,
  freq: -1,
  note: null,
  stringIndex: -1,
  cents: 0,
});

describe("tunerView", () => {
  it("맞음은 ±6¢를 넘어야 빠진다 (경계에서 포즈 깜빡임 방지)", () => {
    expect(tunerView("good", ok(-5), 0).pose).toBe("flat"); // 들어갈 때는 ±4¢
    expect(tunerView("good", ok(-5), 0, true).pose).toBe("intune");
    expect(tunerView("good", ok(-6.5), 0, true).pose).toBe("flat");
  });

  it("±4¢ 안은 만세", () => {
    expect(tunerView("good", ok(1), 0).pose).toBe("intune");
    expect(tunerView("good", ok(-4), 0).pose).toBe("intune");
    expect(tunerView("good", ok(1), 0).tone).toBe("ok");
  });
  it("낮으면 축 처짐, 높으면 까치발", () => {
    expect(tunerView("good", ok(-18), 0)).toMatchObject({ pose: "flat", centsLabel: "♭ 낮음" });
    expect(tunerView("good", ok(23), 0)).toMatchObject({ pose: "sharp", centsLabel: "♯ 높음" });
  });
  it("과입력이 가장 먼저", () => {
    expect(tunerView("clip", ok(0), 0).pose).toBe("clip");
  });
  it("불안정은 갸우뚱, 숫자 대신 말", () => {
    expect(tunerView("good", none("unstable"), 0)).toMatchObject({ pose: "unsure", blank: true });
  });
  it("조용하면 기다리다가 4초 뒤 쿨쿨 + 케이블 안내", () => {
    expect(tunerView("none", none("silent"), 1000)).toMatchObject({
      pose: "idle",
      showCableHint: false,
    });
    expect(tunerView("none", none("silent"), 5000)).toMatchObject({
      pose: "sleep",
      showCableHint: true,
      waitWord: "신호 없음",
    });
  });
});

describe("formatCents · rulerPercent", () => {
  it("시안 표기", () => {
    expect(formatCents(1.2)).toBe("+1¢");
    expect(formatCents(-18.4)).toBe("−18¢");
    expect(formatCents(0.3)).toBe("0¢");
  });
  it("자 끝에 붙인다", () => {
    expect(rulerPercent(0)).toBe(50);
    expect(rulerPercent(-200)).toBe(2);
    expect(rulerPercent(80)).toBe(98);
  });

  it("맞음 기억은 줄 번호로, 확정값일 때만 바뀌고 소리가 끝나면 지워진다", () => {
    const at = (cents: number, stringIndex: number): PitchReading => ({
      ...ok(cents),
      stringIndex,
    });
    const step = (prev: number, p: PitchReading) =>
      nextInTuneString(prev, "good", p, tunerView("good", p, 0, p.stringIndex === prev));
    let m = step(-1, at(-3, 1)); // A줄 맞음
    expect(m).toBe(1);
    m = step(m, none("listening")); // 잠깐 분석 중 → 기억 유지
    expect(m).toBe(1);
    expect(tunerView("good", at(-5, 1), 0, m === 1).pose).toBe("intune"); // 다시 오면 ±6¢ 기준
    expect(tunerView("good", at(-5, 2), 0, m === 2).pose).toBe("flat"); // 다른 줄은 ±4¢부터
    expect(step(m, none("silent"))).toBe(-1);
  });
});
