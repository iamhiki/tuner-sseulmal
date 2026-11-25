import { audioContextCtor } from "./deviceManager.ts";

/**
 * 분석 그래프 (기획 5장):
 *   입력 → 모노 다운믹스 ┬→ 레벨 분석기 (2048, 필터 전 원신호)
 *                        └→ 하이패스 25 Hz → 로우패스 900 Hz → 음정 분석기 (8192)
 * 스피커로는 아무것도 내보내지 않는다.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private input: AudioNode | null = null;
  private nodes: AudioNode[] = [];
  private stopTone: (() => void) | null = null;
  private levelAnalyser: AnalyserNode | null = null;
  private pitchAnalyser: AnalyserNode | null = null;
  readonly levelBuf = new Float32Array(2048);
  readonly pitchBuf = new Float32Array(8192);

  get sampleRate(): number {
    return this.ctx?.sampleRate ?? 48000;
  }

  get attached(): boolean {
    return this.input !== null;
  }

  /** 사용자 동작(클릭) 안에서 불러야 자동 재생 정책에 안 막힌다. */
  async ensureContext(): Promise<AudioContext> {
    if (!this.ctx) {
      const AC = audioContextCtor();
      if (!AC) throw new Error("Web Audio 미지원");
      this.ctx = new AC({ latencyHint: "interactive" });
    }
    if (this.ctx.state === "suspended") await this.ctx.resume();
    return this.ctx;
  }

  async attachStream(stream: MediaStream): Promise<void> {
    const ctx = await this.ensureContext();
    this.build(ctx.createMediaStreamSource(stream));
  }

  /**
   * 개발·데모용 합성음 입력 (주소에 ?tone). 베이스처럼 2·3배음이 큰 소리를
   * E1 → A1 → D2 → G2 순서로 바꿔 가며 치고, 사이사이 쉬는 구간을 둔다.
   * D2는 치는 순간 A줄 공명(110 Hz)을 잠깐 섞어 #8의 튐을 흉내 낸다.
   */
  async attachTestTone(): Promise<void> {
    const ctx = await this.ensureContext();
    const out = ctx.createGain();
    out.gain.value = 0;
    const oscs: OscillatorNode[] = [];
    const parts: [number, number][] = [
      [1, 0.25],
      [2, 0.45],
      [3, 0.3],
      [4, 0.15],
      [5, 0.08],
    ];
    for (const [, g] of parts) {
      const o = ctx.createOscillator();
      const gn = ctx.createGain();
      gn.gain.value = g;
      o.connect(gn).connect(out);
      o.start();
      oscs.push(o);
    }
    const spike = ctx.createOscillator();
    const spikeGain = ctx.createGain();
    spikeGain.gain.value = 0;
    spike.frequency.value = 110;
    spike.connect(spikeGain).connect(out);
    spike.start();

    // [주파수, 센트, 길이(초)] 0 Hz는 쉬는 구간
    const plan: [number, number, number][] = [
      [41.2034, -18, 3],
      [55, 1, 3],
      [73.4162, 23, 3],
      [97.9989, 0, 3],
      [0, 0, 6],
    ];
    let i = 0;
    let timer = 0;
    const next = () => {
      const [f, c, len] = plan[i++ % plan.length];
      const t = ctx.currentTime;
      out.gain.cancelScheduledValues(t);
      if (f > 0) {
        for (const [n, o] of oscs.entries())
          o.frequency.setValueAtTime(f * parts[n][0] * 2 ** (c / 1200), t);
        out.gain.setValueAtTime(0.5, t);
        out.gain.exponentialRampToValueAtTime(0.08, t + len);
        if (f === 73.4162) {
          spikeGain.gain.setValueAtTime(0.6, t);
          spikeGain.gain.setValueAtTime(0, t + 0.06);
        }
      } else out.gain.setValueAtTime(0, t);
      timer = window.setTimeout(next, len * 1000);
    };
    next();
    this.build(out);
    this.stopTone = () => {
      window.clearTimeout(timer);
      for (const o of [...oscs, spike]) o.stop();
    };
  }

  private build(input: AudioNode): void {
    this.detach();
    const ctx = this.ctx!;
    const mono = ctx.createGain();
    mono.channelCount = 1;
    mono.channelCountMode = "explicit";
    mono.channelInterpretation = "speakers";
    const level = ctx.createAnalyser();
    level.fftSize = 2048;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 25;
    hp.Q.value = Math.SQRT1_2;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 900;
    lp.Q.value = Math.SQRT1_2;
    const pitch = ctx.createAnalyser();
    pitch.fftSize = 8192;
    input.connect(mono);
    mono.connect(level);
    mono.connect(hp).connect(lp).connect(pitch);
    this.input = input;
    this.nodes = [input, mono, level, hp, lp, pitch];
    this.levelAnalyser = level;
    this.pitchAnalyser = pitch;
  }

  /** 이번 프레임의 버퍼를 채운다. 연결 전이면 false. */
  read(): boolean {
    if (!this.levelAnalyser || !this.pitchAnalyser) return false;
    this.levelAnalyser.getFloatTimeDomainData(this.levelBuf);
    this.pitchAnalyser.getFloatTimeDomainData(this.pitchBuf);
    return true;
  }

  detach(): void {
    this.stopTone?.();
    this.stopTone = null;
    for (const n of this.nodes) {
      try {
        n.disconnect();
      } catch {
        // 이미 끊긴 노드
      }
    }
    this.nodes = [];
    this.input = this.levelAnalyser = this.pitchAnalyser = null;
    this.levelBuf.fill(0);
    this.pitchBuf.fill(0);
  }
}
