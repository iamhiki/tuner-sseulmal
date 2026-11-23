/**
 * 옥타브 유지: 줄이 잦아들며 검출값이 직전 음의 정확히 2배로 튀면 원래 음을 유지한다.
 *
 * 베이스 저음현(E1·A1)은 감쇠하면서 기본음이 2배음보다 먼저 사라진다 (실측: 꼬리에서
 * 기본음이 2배음보다 -20 ~ -43 dB). 그 프레임 하나만 보면 "기본음이 빠진 A1"과
 * "공명 성분이 섞인 G2"는 같은 신호라 검출기 단독으로는 구분할 수 없다. 구분할 수 있는
 * 정보는 시간이다: 같은 줄이 울리는 동안 음이 갑자기 정확히 한 옥타브 오르지는 않는다.
 *
 * 새로 친 소리(레벨이 유지 시작 후 최저점보다 +6 dB 이상 오름)나 신호 끊김에서는 풀린다.
 */

/** 직전 음의 2배에서 이 센트 안이면 옥타브 튐으로 본다. */
const OCTAVE_JUMP_CENTS = 35;
/** 유지 중 최저 RMS보다 이 배수 이상 커지면 새로 친 것으로 본다 (+6 dB). */
const ONSET_RATIO = 2;

export class OctaveHold {
  private held = -1;
  private floorRms = Number.POSITIVE_INFINITY;

  reset(): void {
    this.held = -1;
    this.floorRms = Number.POSITIVE_INFINITY;
  }

  /** 검출 결과(freq ≤ 0이면 음 없음)를 받아 옥타브 튐을 바로잡은 주파수를 돌려준다. */
  update(freq: number, rms: number): number {
    if (freq <= 0) {
      this.reset();
      return freq;
    }
    const onset = rms > this.floorRms * ONSET_RATIO;
    this.floorRms = onset ? rms : Math.min(this.floorRms, rms);

    let f = freq;
    if (
      !onset &&
      this.held > 0 &&
      Math.abs(1200 * Math.log2(f / (2 * this.held))) < OCTAVE_JUMP_CENTS
    )
      f /= 2;
    this.held = f;
    return f;
  }
}
