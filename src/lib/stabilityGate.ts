/**
 * 안정도 게이트: 비슷한 값이 몇 프레임 연속 나와야 화면에 보여준다.
 *
 * 줄을 치는 순간에는 피킹 잡음과 옆 줄 공명이 섞여 0.1초 남짓 엉뚱한 값이 나온다
 * (실측: D2를 칠 때 A줄 공명으로 108~111 Hz 4회, G2를 칠 때 68 Hz 1회, #8).
 * 그 뒤로는 끝까지 정확하므로, 같은 음이 연속으로 확인된 값만 내보내면 튐이 사라진다.
 * 기획 규칙 "믿을 수 없는 결과는 표시하지 않는다"와 같은 방향이다.
 *
 * - 처음 소리가 나면 `minFrames`번 연속 일치할 때까지 -1(분석 중)을 돌려준다.
 * - 한 번 확정된 뒤 튀는 값이 와도, 새 값이 `minFrames`번 연속되기 전까지는 직전 확정값을 유지한다.
 * - 튜닝을 돌릴 때처럼 천천히 바뀌는 값은 프레임 사이 차이가 작아서 그대로 따라간다.
 * - 확정 없이 `maxHoldFrames`번 넘게 어긋나면 -1(불안정)로 내린다.
 * - 신호가 끊기면(freq ≤ 0) 바로 초기화한다.
 *
 * 앱에서는 detect() → OctaveHold → StabilityGate → One-Euro 순서로 쓴다.
 */

export interface StabilityGateOptions {
  /** 확정에 필요한 연속 일치 프레임 수. 60fps에서 5프레임 ≈ 0.08초. */
  minFrames?: number;
  /** 연속 프레임끼리 이 센트 안이면 같은 음으로 본다. */
  toleranceCents?: number;
  /** 확정값을 유지하는 최대 어긋남 프레임 수. 넘으면 -1을 돌려준다. */
  maxHoldFrames?: number;
}

export type GateState = "idle" | "pending" | "stable" | "holding";

const cents = (a: number, b: number) => 1200 * Math.log2(a / b);

export class StabilityGate {
  readonly minFrames: number;
  readonly toleranceCents: number;
  readonly maxHoldFrames: number;

  private candidate = -1;
  private count = 0;
  private shown = -1;
  private misses = 0;
  private _state: GateState = "idle";

  constructor(options: StabilityGateOptions = {}) {
    this.minFrames = Math.max(1, options.minFrames ?? 5);
    this.toleranceCents = options.toleranceCents ?? 50;
    this.maxHoldFrames = options.maxHoldFrames ?? 15;
  }

  /** 마지막 update 결과의 상태. UI에서 "분석 중"/"불안정" 문구를 고를 때 쓴다. */
  get state(): GateState {
    return this._state;
  }

  reset(): void {
    this.candidate = -1;
    this.count = 0;
    this.shown = -1;
    this.misses = 0;
    this._state = "idle";
  }

  /** 프레임 하나의 검출값을 받아 화면에 보여줄 값(없으면 -1)을 돌려준다. */
  update(freq: number): number {
    if (!(freq > 0)) {
      this.reset();
      return -1;
    }

    if (this.candidate > 0 && Math.abs(cents(freq, this.candidate)) < this.toleranceCents) {
      this.count++;
    } else {
      this.count = 1;
    }
    this.candidate = freq;

    if (this.count >= this.minFrames) {
      this.shown = freq;
      this.misses = 0;
      this._state = "stable";
      return freq;
    }

    // 확정 직후 따라오는 값이 확정값과 가까우면 그대로 따라간다 (튜닝 조정).
    if (this.shown > 0 && Math.abs(cents(freq, this.shown)) < this.toleranceCents) {
      this.shown = freq;
      this.misses = 0;
      this._state = "stable";
      return freq;
    }

    if (this.shown > 0 && ++this.misses <= this.maxHoldFrames) {
      this._state = "holding";
      return this.shown;
    }

    this.shown = -1;
    this._state = "pending";
    return -1;
  }
}
