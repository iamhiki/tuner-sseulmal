import { describe, expect, it } from "vitest";
import { bassTuning } from "../lib/bass.ts";
import { PitchPipeline } from "./pitchPipeline.ts";

const SR = 48000;
const LEN = 8192; // 앱의 AnalyserNode fftSize와 같다
const FRAME_MS = 1000 / 60;
const HOP = Math.round(SR / 60); // AnalyserNode 창은 프레임마다 약 800샘플씩 밀린다

/** 베이스처럼 2·3배음이 기본음보다 큰 합성음. t0: 시작 샘플(창이 밀리는 것을 흉내). */
function bass(freq: number, t0: number, amp = 0.3): Float32Array {
  const parts = [
    [1, 0.25],
    [2, 0.45],
    [3, 0.3],
    [4, 0.15],
    [5, 0.08],
  ];
  const buf = new Float32Array(LEN);
  for (let i = 0; i < LEN; i++) {
    let s = 0;
    for (const [k, g] of parts) s += g * Math.sin((2 * Math.PI * k * freq * (t0 + i)) / SR);
    buf[i] = amp * s;
  }
  return buf;
}

function play(p: PitchPipeline, freqs: number[]) {
  return freqs.map((f, n) =>
    p.process(f > 0 ? bass(f, n * HOP) : new Float32Array(LEN), SR, n * FRAME_MS),
  );
}

const strings = bassTuning.strings;

describe("PitchPipeline", () => {
  for (const [i, s] of strings.entries()) {
    it(`${s.name}${s.octave} 개방현을 맞는 줄·센트로 읽는다`, () => {
      const out = play(new PitchPipeline(strings), Array(20).fill(s.freq));
      // 게이트: 처음 4프레임은 분석 중
      expect(out.slice(0, 4).every((r) => r.status === "listening")).toBe(true);
      const last = out[out.length - 1];
      expect(last.status).toBe("ok");
      expect(last.stringIndex).toBe(i);
      expect(Math.abs(last.cents)).toBeLessThan(5);
      expect(last.note?.name).toBe(s.name);
      expect(last.note?.octave).toBe(s.octave);
    });
  }

  it("18센트 낮은 D2는 D줄 −18¢로 읽는다", () => {
    const f = strings[2].freq * 2 ** (-18 / 1200);
    const out = play(new PitchPipeline(strings), Array(40).fill(f));
    const last = out[out.length - 1];
    expect(last.stringIndex).toBe(2);
    expect(last.cents).toBeGreaterThan(-23);
    expect(last.cents).toBeLessThan(-13);
  });

  it("D2를 칠 때 A줄 공명(110 Hz)이 잠깐 섞여도 화면에 안 나온다 (#8)", () => {
    const out = play(new PitchPipeline(strings), [110, 109, 110.5, ...Array(20).fill(73.42)]);
    for (const r of out) if (r.status === "ok") expect(r.stringIndex).toBe(2);
    expect(out[out.length - 1].status).toBe("ok");
  });

  it("무음은 silent", () => {
    const out = play(new PitchPipeline(strings), [0, 0, 0]);
    expect(out.every((r) => r.status === "silent")).toBe(true);
  });

  it("줄을 고정하면 다른 음이어도 그 줄 기준 센트를 보여준다", () => {
    const p = new PitchPipeline(strings);
    p.setLockedString(0); // E1
    const out = play(p, Array(20).fill(strings[0].freq * 2 ** (-30 / 1200)));
    const last = out[out.length - 1];
    expect(last.stringIndex).toBe(0);
    expect(last.cents).toBeLessThan(-20);
  });

  it("소리가 끊기면 바로 silent로 돌아가고 다시 분석부터 한다", () => {
    const out = play(new PitchPipeline(strings), [...Array(10).fill(55), 0, ...Array(3).fill(55)]);
    expect(out[9].status).toBe("ok");
    expect(out[10].status).toBe("silent");
    expect(out[11].status).toBe("listening");
  });
});

describe("PitchPipeline 줄 바꿔 치기", () => {
  it("A1 꼬리 위에 D2를 치면 D2로 읽는다 (공격음 저음을 옥타브 기준으로 잡지 않음)", () => {
    // 합성음 재현: A1이 잦아드는 중 D2(+23¢)를 치고, 첫 60 ms에 A줄 공명(110 Hz)이 섞인다.
    // 고치기 전에는 섞인 창에서 나온 37 Hz를 OctaveHold가 기준으로 잡아 D2(74 Hz)를 계속
    // 37.2 Hz(−177¢)로 깎았다.
    const total = SR * 4;
    const sig = new Float32Array(total);
    const parts = [
      [1, 0.25],
      [2, 0.45],
      [3, 0.3],
      [4, 0.15],
      [5, 0.08],
    ];
    const ph = parts.map(() => 0);
    let sp = 0;
    for (let i = 0; i < total; i++) {
      const t = i / SR;
      const second = t >= 2;
      const f = second ? 73.4162 * 2 ** (23 / 1200) : 55;
      const ts = second ? t - 2 : t;
      let s = 0;
      for (const [n, [k, a]] of parts.entries()) {
        ph[n] += (2 * Math.PI * k * f) / SR;
        s += a * Math.sin(ph[n]);
      }
      sp += (2 * Math.PI * 110) / SR;
      if (second && ts < 0.06) s += 1.2 * Math.sin(sp);
      sig[i] = 0.175 * 0.16 ** (ts / 3) * s;
    }
    const p = new PitchPipeline(strings);
    const out = [];
    for (let n = 0; n * HOP + LEN < total; n++)
      out.push(p.process(sig.subarray(n * HOP, n * HOP + LEN), SR, n * FRAME_MS));
    const last = out[out.length - 1];
    expect(last.status).toBe("ok");
    expect(last.stringIndex).toBe(2);
    expect(last.cents).toBeGreaterThan(15);
    expect(last.cents).toBeLessThan(30);
    // 친 뒤 0.4초 안에 D2로 자리 잡는다. (섞인 창 때문에 그 전에 D1이 잠깐 보일 수 있다:
    // 합성음에서 약 6프레임. 실제 연주에서 보이는지는 #8과 함께 확인)
    const switchFrame = Math.ceil((2 * SR - LEN) / HOP);
    const settled = out.findIndex(
      (r, n) => n > switchFrame && r.status === "ok" && r.stringIndex === 2,
    );
    expect(settled).toBeGreaterThan(0);
    expect(((settled - switchFrame) * FRAME_MS) / 1000 - LEN / SR).toBeLessThan(0.4);
    for (const r of out.slice(settled)) expect(r.stringIndex).toBe(2);
  });

  /**
   * 배음끼리 높이가 조금씩 다른 줄 (실측 G2: 1배음 -12¢, 3배음 +5¢)을 흉내 낸다.
   * 높은 배음이 먼저 사라진다. centsAt(t): 줄감개로 바꾼 음 높이 (센트).
   */
  function decaying(freq: number, seconds: number, centsAt = (_t: number) => 0) {
    const parts: Array<[number, number, number, number]> = [
      // [차수, 센트 차이, 처음 세기, 사라지는 시간(초)]
      [1, -12, 0.2, 30],
      [2, 0, 0.45, 12],
      [3, 5, 0.35, 2],
      [4, 2, 0.25, 1.5],
    ];
    const n = Math.round(seconds * SR) + LEN;
    const x = new Float32Array(n);
    const phase = parts.map(() => 0);
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      const f = freq * 2 ** (centsAt(t) / 1200);
      let v = 0;
      parts.forEach(([k, c, g, tau], j) => {
        phase[j] += (2 * Math.PI * k * f * 2 ** (c / 1200)) / SR;
        v += g * Math.exp(-t / tau) * Math.sin(phase[j]);
      });
      x[i] = 0.3 * v;
    }
    return (p: PitchPipeline) => {
      const out = [];
      for (let k = 0; k * HOP + LEN <= n; k++)
        out.push(p.process(x.subarray(k * HOP, k * HOP + LEN), SR, k * FRAME_MS));
      return out;
    };
  }

  it("한 음이 울리는 동안 배음이 사라져도 값이 흘러가지 않는다", () => {
    const out = decaying(strings[3].freq, 10)(new PitchPipeline(strings));
    const c = out
      .slice(90)
      .filter((r) => r.status === "ok")
      .map((r) => r.cents); // 1.5초 뒤부터
    expect(c.length).toBeGreaterThan(400);
    expect(Math.max(...c) - Math.min(...c)).toBeLessThan(2);
  });

  it("울리는 중 줄감개를 돌리면 따라간다 (1초에 +60¢)", () => {
    const glide = (t: number) => (t < 1.5 ? 0 : Math.min(60, (t - 1.5) * 60));
    const out = decaying(strings[3].freq, 4, glide)(new PitchPipeline(strings));
    const last = out[out.length - 1];
    expect(last.status).toBe("ok");
    expect(last.stringIndex).toBe(3);
    expect(Math.abs(last.cents - 60)).toBeLessThan(3);
  });
});
