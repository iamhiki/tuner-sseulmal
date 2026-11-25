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
 * - 확정 없이 `maxHoldFrames`번 넘게 어긋나면 -1을 돌려주고 상태를 "unstable"로 둔다.
 * - 신호가 끊기면(freq ≤ 0) 바로 초기화한다.
 *
 * 앱에서는 detect() → OctaveHold → StabilityGate → One-Euro 순서로 쓴다.
 * 게이트가 -1을 돌려주면 One-Euro 필터에 넣지 말고 필터를 reset()해야 한다
 * (-1을 숫자로 섞으면 실제 음으로 넘어가는 동안 엉뚱한 중간값이 나온다).
 */

export interface StabilityGateOptions {
  /** 확정에 필요한 연속 일치 프레임 수. 60fps에서 5프레임 ≈ 0.08초. */
  minFrames?: number;
  /** 연속 프레임끼리 이 센트 안이면 같은 음으로 본다. */
  toleranceCents?: number;
  /** 확정값을 유지하는 최대 어긋남 프레임 수. 넘으면 -1을 돌려준다. */
  maxHoldFrames?: number;
}

/** idle: 신호 없음 · pending: 처음 분석 중 · stable: 확정 · holding: 잠깐 튐, 직전 값 유지 · unstable: 확정을 잃음 */
export type GateState = "idle" | "pending" | "stable" | "holding" | "unstable";

const cents = (a: number, b: number) => 1200 * Math.log2(a / b);

export class StabilityGate {
  readonly minFrames: number;
  readonly toleranceCents: number;
  readonly maxHoldFrames: number;

  /** 지금 세고 있는 연속 구간의 기준 주파수 (구간 첫 값 또는 직전 확정값). */
  private anchor = -1;
  private count = 0;
  private shown = -1;
  private misses = 0;
  private lostLock = false;
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
    this.anchor = -1;
    this.count = 0;
    this.shown = -1;
    this.misses = 0;
    this.lostLock = false;
    this._state = "idle";
  }

  private near(a: number, b: number): boolean {
    return Math.abs(cents(a, b)) <= this.toleranceCents + 1e-9; // 부동소수점 오차 허용
  }

  /** 프레임 하나의 검출값을 받아 화면에 보여줄 값(없으면 -1)을 돌려준다. */
  update(freq: number): number {
    if (!(freq > 0)) {
      this.reset();
      return -1;
    }

    // 연속 구간은 첫 값(기준)과 비교한다. 직전 값과만 비교하면 조금씩 흘러가는
    // 공격음도 확정돼 버린다.
    if (this.anchor > 0 && this.near(freq, this.anchor)) {
      this.count++;
    } else {
      this.anchor = freq;
      this.count = 1;
    }

    // 확정값과 가까우면(튜닝 조정) 바로 따라가고, 새 구간이 minFrames를 채워도 확정한다.
    if (this.count >= this.minFrames || (this.shown > 0 && this.near(freq, this.shown))) {
      this.shown = freq;
      this.anchor = freq;
      this.misses = 0;
      this.lostLock = false;
      this._state = "stable";
      return freq;
    }

    if (this.shown > 0 && ++this.misses <= this.maxHoldFrames) {
      this._state = "holding";
      return this.shown;
    }

    if (this.shown > 0) this.lostLock = true;
    this.shown = -1;
    this._state = this.lostLock ? "unstable" : "pending";
    return -1;
  }
}
