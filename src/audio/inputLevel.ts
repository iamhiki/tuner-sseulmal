/**
 * F-04 입력 레벨. 장치 테스트 페이지(PR #5)의 기준을 그대로 옮겼다.
 * 음정 검출과 별개로 "소리가 들어오는지"만 본다 (기획 6장 B).
 */

/** dBFS 기준값. 적정: 세게 쳤을 때 피크가 -18 ~ -1 dBFS. */
export const LEVEL = { none: -60, goodPeak: -18, clip: -1 } as const;

/** 피크 홀드 유지 시간 (ms). */
const PEAK_HOLD_MS = 2000;
/** 클리핑 표시 유지 시간 (ms). */
const CLIP_SHOW_MS = 1500;

export type LevelState = "none" | "low" | "good" | "clip";

export interface LevelReading {
  rmsDb: number;
  peakDb: number;
  /** 최근 2초 피크. 미터 막대와 상태 판정에 쓴다. */
  peakHoldDb: number;
  state: LevelState;
  /** 막대 길이 0~1. 0.25 / 0.8 경계가 화면의 "너무 작음 · 적정 · 과입력" 구역과 맞는다. */
  bar: number;
  clipCount: number;
}

export const toDb = (x: number) => (x > 0 ? 20 * Math.log10(x) : Number.NEGATIVE_INFINITY);

export function measure(buf: Float32Array): { rms: number; peak: number } {
  let sum = 0;
  let peak = 0;
  for (let i = 0; i < buf.length; i++) {
    const v = buf[i];
    sum += v * v;
    const a = Math.abs(v);
    if (a > peak) peak = a;
  }
  return { rms: buf.length ? Math.sqrt(sum / buf.length) : 0, peak };
}

/**
 * dBFS → 막대 길이. 구역 경계에 기준값을 맞춘다:
 * -60 → 0, -18(적정 시작) → 0.25, -1(클리핑) → 0.8, 0 → 1.
 */
export function levelToBar(db: number): number {
  if (!Number.isFinite(db) || db <= LEVEL.none) return 0;
  if (db < LEVEL.goodPeak) return (0.25 * (db - LEVEL.none)) / (LEVEL.goodPeak - LEVEL.none);
  if (db < LEVEL.clip) return 0.25 + (0.55 * (db - LEVEL.goodPeak)) / (LEVEL.clip - LEVEL.goodPeak);
  return Math.min(1, 0.8 + (0.2 * (db - LEVEL.clip)) / -LEVEL.clip);
}

/** 프레임마다 버퍼를 받아 레벨 상태를 판정한다. 시간은 ms(performance.now 기준). */
export class LevelTracker {
  private hold = { v: Number.NEGATIVE_INFINITY, t: 0 };
  private lastClipAt = Number.NEGATIVE_INFINITY;
  private clips = 0;

  reset(): void {
    this.hold = { v: Number.NEGATIVE_INFINITY, t: 0 };
    this.lastClipAt = Number.NEGATIVE_INFINITY;
    this.clips = 0;
  }

  update(buf: Float32Array, now: number): LevelReading {
    const { rms, peak } = measure(buf);
    return this.updateFromValues(rms, peak, now);
  }

  updateFromValues(rms: number, peak: number, now: number): LevelReading {
    const rmsDb = toDb(rms);
    const peakDb = toDb(peak);
    if (peakDb > this.hold.v || now - this.hold.t > PEAK_HOLD_MS) this.hold = { v: peakDb, t: now };
    if (peakDb >= LEVEL.clip && now - this.lastClipAt > 300) {
      this.clips++;
      this.lastClipAt = now;
    }
    const held = this.hold.v;
    let state: LevelState;
    if (now - this.lastClipAt < CLIP_SHOW_MS) state = "clip";
    else if (rmsDb < LEVEL.none && held < LEVEL.none + 6) state = "none";
    else if (held < LEVEL.goodPeak) state = "low";
    else state = "good";
    return { rmsDb, peakDb, peakHoldDb: held, state, bar: levelToBar(held), clipCount: this.clips };
  }
}
