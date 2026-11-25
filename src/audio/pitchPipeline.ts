import { BASS_RANGE } from "../lib/bass.ts";
import { centsOff, type Note, nearestNote, TargetTracker } from "../lib/notes.ts";
import { OctaveHold } from "../lib/octaveHold.ts";
import { OneEuroFilter } from "../lib/oneEuro.ts";
import { createPitchDetector, type HarmonicRef, RMS_THRESHOLD } from "../lib/pitch.ts";
import { StabilityGate } from "../lib/stabilityGate.ts";

/**
 * 음정 파이프라인: detect() → OctaveHold → StabilityGate → (목표 줄 선택) → One-Euro.
 *
 * - OctaveHold(PR #6): 저음현 꼬리에서 정확히 한 옥타브 위로 튀는 값을 원래 음으로 되돌린다.
 * - StabilityGate(#8): 치는 순간의 엉뚱한 값을 숨긴다. -1이면 One-Euro를 reset한다.
 * - One-Euro: 센트 단위로 바늘을 부드럽게. 목표 줄이 바뀌면 reset한다.
 * - 배음 기준 고정: 값이 확정되고 CAPTURE_FRAMES 뒤의 배음 가중치·비율을 그 음이 끝날 때까지 쓴다.
 *   배음끼리 높이가 조금씩 다른 줄(실측 G2: 1배음 -12¢, 3배음 +5¢)은 높은 배음이 먼저 사라지면
 *   세기 가중 평균이 끌려가 줄은 그대로인데 값이 10초 동안 -7¢ 흘렀다.
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

/** 확정 뒤 이만큼 지나 배음 가중치를 잡는다. 60fps에서 0.5초 (치는 순간의 밝은 소리를 피한다). */
const CAPTURE_FRAMES = 30;
/** 가중치를 잡은 음에서 이만큼 벗어나면 새 음으로 보고 다시 잡는다. */
const RECAPTURE_CENTS = 50;

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
  private fixed: HarmonicRef | null = null;
  private fixedFreq = -1;
  private stableFrames = 0;

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
    this.dropWeights();
  }

  private dropWeights(): void {
    this.fixed = null;
    this.fixedFreq = -1;
    this.stableFrames = 0;
  }

  /** @param now 시각 (ms) */
  process(buffer: Float32Array, sampleRate: number, now: number): PitchReading {
    const r = this.detector.detect(buffer, sampleRate, this.fixed);
    const f = this.octave.update(r.freq, r.rms);
    const shown = this.gate.update(f);
    const dt = this.lastTime < 0 ? 0 : (now - this.lastTime) / 1000;
    this.lastTime = now;

    if (!(shown > 0)) {
      this.euro.reset();
      this.lastString = -1;
      this.dropWeights();
      if (r.rms < RMS_THRESHOLD) return SILENT;
      return { ...SILENT, status: this.gate.state === "unstable" ? "unstable" : "listening" };
    }

    const index = this.locked ?? this.tracker.string(shown, this.strings).index;
    if (index !== this.lastString) {
      this.euro.reset();
      this.lastString = index;
      this.dropWeights();
    }
    if (this.fixed && Math.abs(centsOff(shown, this.fixedFreq)) > RECAPTURE_CENTS)
      this.dropWeights();
    // 옥타브를 바로잡은 프레임은 배음 차수가 어긋나므로 가중치를 잡지 않는다.
    if (
      !this.fixed &&
      this.gate.state === "stable" &&
      f === r.freq &&
      ++this.stableFrames >= CAPTURE_FRAMES
    ) {
      const h = this.detector.lastHarmonics();
      this.fixed = {
        weights: Float32Array.from(h.weights),
        ratios: Float32Array.from(h.ratios),
        f0: h.f0,
      };
      this.fixedFreq = shown;
    }
    const target = this.strings[index];
    const cents = this.euro.filter(centsOff(shown, target.freq), dt);
    const freq = target.freq * 2 ** (cents / 1200);
    return { status: "ok", freq, note: nearestNote(freq).note, stringIndex: index, cents };
  }
}
