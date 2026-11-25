import { BASS_RANGE } from "../lib/bass.ts";
import { centsOff, type Note, nearestNote, TargetTracker } from "../lib/notes.ts";
import { OctaveHold } from "../lib/octaveHold.ts";
import { OneEuroFilter } from "../lib/oneEuro.ts";
import { createPitchDetector, RMS_THRESHOLD } from "../lib/pitch.ts";
import { StabilityGate } from "../lib/stabilityGate.ts";

/**
 * 음정 파이프라인: detect() → OctaveHold → StabilityGate → (목표 줄 선택) → One-Euro.
 *
 * - OctaveHold(PR #6): 저음현 꼬리에서 정확히 한 옥타브 위로 튀는 값을 원래 음으로 되돌린다.
 * - StabilityGate(#8): 치는 순간의 엉뚱한 값을 숨긴다. -1이면 One-Euro를 reset한다.
 * - One-Euro: 센트 단위로 바늘을 부드럽게. 목표 줄이 바뀌면 reset한다.
 *
 * 프레임마다(requestAnimationFrame, 약 60fps) 한 번 부른다. 게이트의 프레임 수가 이 속도를 기준으로 정해져 있다.
 */

/**
 * silent: 소리가 없음 · listening: 소리는 있는데 아직 확정 전 · unstable: 확정을 잃음(신호 불안정)
 * · ok: 믿을 수 있는 값
 */
export type PitchStatus = "silent" | "listening" | "unstable" | "ok";

export interface PitchReading {
  status: PitchStatus;
  /** 보여줄 주파수 (Hz). status가 ok가 아니면 -1. */
  freq: number;
  /** freq에 가장 가까운 반음. */
  note: Note | null;
  /** 목표 줄 번호 (낮은 줄부터 0). 확정값이 없으면 -1. */
  stringIndex: number;
  /** 목표 줄 대비 센트 (부드럽게 한 값). */
  cents: number;
}

const SILENT: PitchReading = { status: "silent", freq: -1, note: null, stringIndex: -1, cents: 0 };

export class PitchPipeline {
  private readonly detector = createPitchDetector({
    minFreq: BASS_RANGE.min,
    maxFreq: BASS_RANGE.max,
  });
  private readonly octave = new OctaveHold();
  private readonly gate = new StabilityGate();
  private readonly tracker = new TargetTracker();
  private readonly euro = new OneEuroFilter();
  private lastTime = -1;
  private lastString = -1;
  private locked: number | null = null;

  constructor(readonly strings: Note[]) {}

  /** 줄을 직접 고르면 그 줄만 목표로 삼는다. null이면 가까운 줄 자동 선택. */
  setLockedString(index: number | null): void {
    this.locked = index;
  }

  get lockedString(): number | null {
    return this.locked;
  }

  reset(): void {
    this.octave.reset();
    this.gate.reset();
    this.tracker.reset();
    this.euro.reset();
    this.lastTime = -1;
    this.lastString = -1;
  }

  /** @param now 시각 (ms) */
  process(buffer: Float32Array, sampleRate: number, now: number): PitchReading {
    const r = this.detector.detect(buffer, sampleRate);
    const f = this.octave.update(r.freq, r.rms);
    const shown = this.gate.update(f);
    const dt = this.lastTime < 0 ? 0 : (now - this.lastTime) / 1000;
    this.lastTime = now;

    if (!(shown > 0)) {
      this.euro.reset();
      this.lastString = -1;
      if (r.rms < RMS_THRESHOLD) return SILENT;
      return { ...SILENT, status: this.gate.state === "unstable" ? "unstable" : "listening" };
    }

    const index = this.locked ?? this.tracker.string(shown, this.strings).index;
    if (index !== this.lastString) {
      this.euro.reset();
      this.lastString = index;
    }
    const target = this.strings[index];
    const cents = this.euro.filter(centsOff(shown, target.freq), dt);
    const freq = target.freq * 2 ** (cents / 1200);
    return { status: "ok", freq, note: nearestNote(freq).note, stringIndex: index, cents };
  }
}
