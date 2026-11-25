/**
 * 옥타브 유지: 줄이 잦아들며 검출값이 직전 음의 정확히 2배로 튀면 원래 음을 유지한다.
 *
 * 베이스 저음현(E1·A1)은 감쇠하면서 기본음이 2배음보다 먼저 사라진다 (실측: 꼬리에서
 * 기본음이 2배음보다 -20 ~ -43 dB). 그 프레임 하나만 보면 "기본음이 빠진 A1"과
 * "공명 성분이 섞인 G2"는 같은 신호라 검출기 단독으로는 구분할 수 없다. 구분할 수 있는
 * 정보는 시간이다: 같은 줄이 울리는 동안 음이 갑자기 정확히 한 옥타브 오르지는 않는다.
 *
 * 새로 친 소리(레벨이 유지 시작 후 최저점보다 +6 dB 이상 오름)나 신호 끊김에서는 풀린다.
 *
 * 새로 친 직후 ATTACK_FRAMES 동안은 바로잡지 않는다. 분석 창(8192샘플 ≈ 0.17초)에 이전 음과
 * 새 음이 섞여 있는 동안 검출값이 엉뚱한 저음(예: A1 꼬리 위에 D2를 치면 37 Hz)으로 나올 수
 * 있는데, 그 값을 기준으로 잡으면 뒤이어 나오는 진짜 D2(74 Hz)를 "2배 튐"으로 보고 줄이 울리는
 * 내내 반으로 깎아 버린다 (앱 연결 중 합성음으로 발견).
 *
 * 같은 이유로, 울리는 도중에도 기준 음은 HELD_FRAMES 넘게 꾸준히 이어진 값만 쓴다. 검출기가
 * 1프레임만 한 옥타브 아래(G2 → 49 Hz)로 읽으면 그 값이 기준이 되어 진짜 G2(98 Hz)를 계속
 * 반으로 깎았다 (실기: 줄감개를 돌리던 1번줄이 "3번줄 -200¢"에 갇힘).
 */

/** 직전 음의 2배에서 이 센트 안이면 옥타브 튐으로 본다. */
const OCTAVE_JUMP_CENTS = 35;
/** 유지 중 최저 RMS보다 이 배수 이상 커지면 새로 친 것으로 본다 (+6 dB). */
const ONSET_RATIO = 2;
/** 새로 친 뒤(또는 처음 소리가 난 뒤) 바로잡지 않는 프레임 수. 60fps에서 0.25초. */
const ATTACK_FRAMES = 15;
/** 기준 음으로 인정하는 최소 연속 프레임 수 (±OCTAVE_JUMP_CENTS 안). 60fps에서 약 0.17초. */
const HELD_FRAMES = 10;

export class OctaveHold {
  private held = -1;
  private floorRms = Number.POSITIVE_INFINITY;
  private sinceOnset = 0;
  private heldFrames = 0;

  reset(): void {
    this.held = -1;
    this.floorRms = Number.POSITIVE_INFINITY;
    this.sinceOnset = 0;
    this.heldFrames = 0;
  }

  /** 검출 결과(freq ≤ 0이면 음 없음)를 받아 옥타브 튐을 바로잡은 주파수를 돌려준다. */
  update(freq: number, rms: number): number {
    if (freq <= 0) {
      this.reset();
      return freq;
    }
    const onset = rms > this.floorRms * ONSET_RATIO;
    this.floorRms = onset ? rms : Math.min(this.floorRms, rms);
    this.sinceOnset = onset ? 0 : this.sinceOnset + 1;

    let f = freq;
    if (
      this.sinceOnset > ATTACK_FRAMES &&
      this.heldFrames >= HELD_FRAMES &&
      Math.abs(1200 * Math.log2(f / (2 * this.held))) < OCTAVE_JUMP_CENTS
    )
      f /= 2;
    const same = this.held > 0 && Math.abs(1200 * Math.log2(f / this.held)) < OCTAVE_JUMP_CENTS;
    this.heldFrames = same ? this.heldFrames + 1 : 1;
    this.held = f;
    return f;
  }
}
