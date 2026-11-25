import type { LevelState } from "../audio/inputLevel.ts";
import type { PitchReading } from "../audio/pitchPipeline.ts";
import type { Pose } from "../components/Mascot.tsx";

/** 이 센트 안이면 "맞음" (시안: 만세 ±4¢). */
export const IN_TUNE_CENTS = 4;
/** 이미 맞음이면 이 센트를 넘어야 빠진다. 경계(±4¢)에 머무는 줄에서 포즈가 깜빡이지 않게. */
export const IN_TUNE_EXIT_CENTS = 6;
/** 신호 없음이 이만큼 이어지면 쿨쿨 + 케이블 안내. */
export const SLEEP_AFTER_MS = 4000;

export interface TunerView {
  pose: Pose;
  say: string;
  /** 숫자 대신 말로 안내하는 상태 (대기/듣는 중/불안정). */
  blank: boolean;
  /** 케이블 안내 상자를 띄울지. */
  showCableHint: boolean;
  /** 센트 아래 한 줄. */
  centsLabel: string;
  /** 센트 자리에 들어갈 말 (blank일 때). */
  waitWord: string;
  /** ok: 초록, off: 토마토, dim: 흐리게 */
  tone: "ok" | "off" | "dim";
}

const SAY: Record<Pose, string> = {
  idle: "줄 하나 튕겨줘",
  flat: "줄 좀 감아줘…",
  sharp: "너무 팽팽해! 살짝 풀어줘",
  intune: "딱 맞았다!",
  sleep: "조용하네… 쿨쿨",
  clip: "으악 너무 커! 게인 좀 줄여줘",
  unsure: "음… 한 줄만 튕겨볼래?",
};

/**
 * "맞음"이었던 줄 번호를 이어 받는다 (-1: 없음). tunerView의 wasInTune에 쓴다.
 * - 확정값(ok)일 때만 갱신한다: 잠깐 "분석 중"이 끼어도 맞음 기억이 지워지지 않게.
 * - 줄 번호로 기억한다: 다른 줄로 바뀌면 그 줄은 ±4¢부터 다시 들어와야 한다.
 * - 소리가 끝나면(silent) 지운다.
 */
export function nextInTuneString(
  prev: number,
  level: LevelState,
  pitch: PitchReading,
  view: TunerView,
): number {
  if (pitch.status === "silent") return -1;
  if (pitch.status !== "ok" || level === "clip") return prev;
  return view.pose === "intune" ? pitch.stringIndex : -1;
}

/**
 * 레벨·음정 상태로 쓸말이 포즈와 안내 문구를 고른다.
 * @param quietMs 레벨이 "신호 없음"으로 이어진 시간
 * @param wasInTune 직전 화면이 "맞음"이었는지
 */
export function tunerView(
  level: LevelState,
  pitch: PitchReading,
  quietMs: number,
  wasInTune = false,
): TunerView {
  const blank = pitch.status !== "ok";
  if (level === "clip") {
    return {
      pose: "clip",
      say: SAY.clip,
      blank,
      showCableHint: false,
      centsLabel: "과입력",
      waitWord: "과입력",
      tone: "off",
    };
  }
  if (pitch.status === "ok") {
    const c = pitch.cents;
    const inTune = Math.abs(c) <= (wasInTune ? IN_TUNE_EXIT_CENTS : IN_TUNE_CENTS);
    const pose: Pose = inTune ? "intune" : c < 0 ? "flat" : "sharp";
    return {
      pose,
      say: SAY[pose],
      blank: false,
      showCableHint: false,
      centsLabel: inTune ? "맞음" : c < 0 ? "♭ 낮음" : "♯ 높음",
      waitWord: "",
      tone: inTune ? "ok" : "off",
    };
  }
  if (pitch.status === "unstable") {
    return {
      pose: "unsure",
      say: SAY.unsure,
      blank: true,
      showCableHint: false,
      centsLabel: "한 줄씩 또렷하게 튕겨줘",
      waitWord: "불안정",
      tone: "dim",
    };
  }
  if (pitch.status === "listening") {
    return {
      pose: "idle",
      say: "듣는 중…",
      blank: true,
      showCableHint: false,
      centsLabel: "소리가 들어오면 숫자가 나와요",
      waitWord: "듣는 중",
      tone: "dim",
    };
  }
  const asleep = level === "none" && quietMs >= SLEEP_AFTER_MS;
  return {
    pose: asleep ? "sleep" : "idle",
    say: asleep ? SAY.sleep : SAY.idle,
    blank: true,
    showCableHint: asleep,
    centsLabel: "소리가 들어오면 숫자가 나와요",
    waitWord: asleep ? "신호 없음" : "듣는 중",
    tone: "dim",
  };
}

export const LEVEL_TEXT: Record<LevelState, string> = {
  none: "아무 소리도 안 들어와",
  low: "너무 작아, 게인 올려줘",
  good: "적정해요",
  clip: "너무 커! 게인 내려줘",
};

/** 센트 표시: 부호는 진짜 마이너스(−)를 쓴다. */
export function formatCents(c: number): string {
  const r = Math.round(c);
  return `${r > 0 ? "+" : r < 0 ? "−" : ""}${Math.abs(r)}¢`;
}

/** 센트 → 자 위 위치(%). ±50¢ 밖은 끝에 붙인다. */
export function rulerPercent(c: number): number {
  return Math.max(2, Math.min(98, c + 50));
}
