// Derived from fgnass/tuner (https://github.com/fgnass/tuner), MIT © 2026 Felix Gnass.
// See THIRD_PARTY_NOTICES.md.

/**
 * Hybrid fundamental-frequency detection.
 *
 * The pipeline is a multi-stage one: a robust, octave-safe coarse estimate →
 * locate the harmonic series in the FFT spectrum seeded by that estimate →
 * derive a precise fundamental from the harmonics (sharpened by sub-bin
 * interpolation and a phase-difference trick) → A-weight the harmonics so
 * inaudible rumble can't bias the result. YIN (de Cheveigné & Kawahara, 2002)
 * handles the coarse stage because it is a strictly better octave-safe period
 * finder than plain autocorrelation, then the spectral refinement layers on top.
 *
 * Why the hybrid beats YIN alone: YIN's parabolic interpolation on the
 * difference function gives one sub-sample estimate from a single lag, whereas
 * averaging several phase-refined harmonics cancels noise and removes bias, and
 * the harmonic view lets us measure inharmonicity and reject non-tonal signals.
 */

import { fft, floorPow2, princarg } from "./fft.ts";

export interface PitchResult {
  /** Detected fundamental in Hz, or -1 when no reliable pitch was found. */
  freq: number;
  /** Periodicity confidence in [0, 1] (1 - YIN dip value). */
  clarity: number;
  /** RMS amplitude of the analysed window. */
  rms: number;
}

/** 튜너쓸말: 배음별 가중치와 (배음 주파수÷차수)/기본음 비율. index = 배음 차수, 0은 없음. */
export interface HarmonicRef {
  weights: Float32Array;
  ratios: Float32Array;
  /** 기준을 잡을 때의 기본음 (Hz). */
  f0: number;
}

export interface DetectorOptions {
  /** Lowest fundamental to search for (Hz). */
  minFreq?: number;
  /** Highest fundamental to search for (Hz). */
  maxFreq?: number;
}

/** Minimum signal energy (RMS) required before we trust a pitch reading. */
export const RMS_THRESHOLD = 0.004;
/** YIN absolute threshold: first dip below this is taken as the period. */
const YIN_THRESHOLD = 0.2;
/** Accept the best (global-min) lag even without a clean dip, up to this value. */
const YIN_FALLBACK = 0.6;
/** Most harmonics we try to track. */
const MAX_HARMONICS = 12;
/** Half-width (as a fraction of f0) of the search band around each harmonic. */
const HARMONIC_TOLERANCE = 0.06;
/** A harmonic peak must exceed this fraction of the strongest peak to count. */
const RELATIVE_PEAK_THRESHOLD = 5e-3;
/** A subharmonic peak must clear this fraction of the strongest peak (power). */
const SUBHARMONIC_FLOOR = 1e-4;
/** ...and stand at least this many times above its local mean power to count. */
const SUBHARMONIC_PROMINENCE = 12;

const NO_PITCH: Readonly<PitchResult> = Object.freeze({
  freq: -1,
  clarity: 0,
  rms: 0,
});

/**
 * Create a stateful detector. State is only scratch buffers — the refinement is
 * computed within each frame (using two windows offset by a known hop), so
 * unlike a cross-frame phase vocoder it does not depend on contiguous capture,
 * which suits the browser's AnalyserNode where successive frames overlap by an
 * unknown amount.
 */
export function createPitchDetector(options: DetectorOptions = {}) {
  const minFreq = options.minFreq ?? 28;
  const maxFreq = options.maxFreq ?? 1500;

  // Lazily-sized scratch, reused across frames — no per-frame allocation in
  // the audio loop.
  let yinBuf = new Float32Array(0);
  let window = new Float32Array(0); // Hann window
  let re1 = new Float32Array(0);
  let im1 = new Float32Array(0);
  let re2 = new Float32Array(0);
  let im2 = new Float32Array(0);
  let mag2 = new Float32Array(0); // |X|² of the first window
  let fftSize = 0;
  let hop = 0;

  function ensureSized(bufLen: number) {
    // FFT window: largest power of two that still leaves room for the hop used
    // by the phase refinement (window + hop must fit inside the capture).
    let m = floorPow2(bufLen);
    while (m + (m >> 2) > bufLen && m > 256) m >>= 1;
    if (m === fftSize) return;
    fftSize = m;
    hop = m >> 2;
    window = new Float32Array(m);
    for (let i = 0; i < m; i++) window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (m - 1)));
    re1 = new Float32Array(m);
    im1 = new Float32Array(m);
    re2 = new Float32Array(m);
    im2 = new Float32Array(m);
    mag2 = new Float32Array((m >> 1) + 1);
  }

  // 튜너쓸말: 마지막 refine()의 배음별 가중치와 "배음 주파수÷차수 ÷ 결과" 비율 (index = 배음 차수, 없으면 0).
  const weights = new Float32Array(MAX_HARMONICS + 1);
  const ratios = new Float32Array(MAX_HARMONICS + 1);
  const perH = new Float32Array(MAX_HARMONICS + 1);
  let lastF0 = -1;

  /**
   * @param ref 튜너쓸말: 같은 음의 앞선 프레임에서 잡은 배음 기준. 주면 각 배음을 그때의 비율로
   *   보정하고 그때의 가중치로 평균 낸다. 배음끼리 높이가 조금씩 다른 줄에서 배음이 사라지는
   *   순서 때문에 값이 끌려가지 않는다 (PitchPipeline 참고).
   */
  function detect(buffer: Float32Array, sampleRate: number, ref?: HarmonicRef | null): PitchResult {
    const n = buffer.length;
    weights.fill(0);
    ratios.fill(0);

    let sumSquares = 0;
    for (let i = 0; i < n; i++) sumSquares += buffer[i] * buffer[i];
    const rms = Math.sqrt(sumSquares / n);
    // 튜너쓸말: 임계값 미만이어도 측정한 RMS를 돌려준다 (레벨 미터가 이 값을 쓴다).
    if (rms < RMS_THRESHOLD) return { ...NO_PITCH, rms };

    const seed = yin(buffer, sampleRate, minFreq, maxFreq);
    if (seed.freq <= 0) return { ...NO_PITCH, clarity: seed.clarity, rms };

    ensureSized(n);
    const refinedFreq = refine(buffer, sampleRate, seed.freq, ref ?? null);

    return {
      // Fall back to the YIN estimate if the spectrum had no usable harmonics.
      freq: refinedFreq > 0 ? refinedFreq : seed.freq,
      clarity: seed.clarity,
      rms,
    };
  }

  /** YIN coarse estimate: octave-safe fundamental + clarity, or freq = -1. */
  function yin(buffer: Float32Array, sampleRate: number, fMin: number, fMax: number) {
    const W = n2(buffer.length); // integration window = half the buffer
    const minLag = Math.max(2, Math.floor(sampleRate / fMax));
    const maxLag = Math.min(W - 1, Math.ceil(sampleRate / fMin));
    if (maxLag <= minLag) return { freq: -1, clarity: 0 };

    if (yinBuf.length < maxLag + 1) yinBuf = new Float32Array(maxLag + 1);
    const yinArr = yinBuf;
    yinArr[0] = 1;
    let runningSum = 0;
    for (let tau = 1; tau <= maxLag; tau++) {
      let sum = 0;
      for (let i = 0; i < W; i++) {
        const d = buffer[i] - buffer[i + tau];
        sum += d * d;
      }
      runningSum += sum;
      yinArr[tau] = runningSum > 0 ? (sum * tau) / runningSum : 1;
    }

    // First dip below the absolute threshold, walked down to its local minimum.
    let tau = -1;
    for (let t = minLag; t <= maxLag; t++) {
      if (yinArr[t] < YIN_THRESHOLD) {
        while (t + 1 <= maxLag && yinArr[t + 1] < yinArr[t]) t++;
        tau = t;
        break;
      }
    }
    if (tau === -1) {
      let best = minLag;
      for (let t = minLag + 1; t <= maxLag; t++) if (yinArr[t] < yinArr[best]) best = t;
      if (yinArr[best] > YIN_FALLBACK) return { freq: -1, clarity: 1 - yinArr[best] };
      tau = best;
    }

    const refinedLag = parabolicMin(yinArr, tau);
    return { freq: sampleRate / refinedLag, clarity: 1 - yinArr[tau] };
  }

  /**
   * Spectral refinement: find the harmonic series around the seed frequency and
   * compute a precise, A-weighted fundamental from it. Returns the refined
   * fundamental in Hz, or -1 when the spectrum had no usable harmonics.
   */
  function refine(
    buffer: Float32Array,
    sampleRate: number,
    f0Seed: number,
    ref: HarmonicRef | null,
  ): number {
    perH.fill(0);
    const m = fftSize;
    const half = m >> 1;
    const df = sampleRate / m;

    // Two Hann-windowed transforms offset by `hop` samples. The first gives the
    // magnitude spectrum and peak picking; the phase advance between the two
    // gives each peak's instantaneous frequency (a phase-vocoder trick, done
    // intra-frame so it needs no contiguous cross-frame capture).
    transform(buffer, 0, re1, im1);
    transform(buffer, hop, re2, im2);

    let maxMag2 = 0;
    for (let k = 1; k <= half; k++) {
      const p = re1[k] * re1[k] + im1[k] * im1[k];
      mag2[k] = p;
      if (p > maxMag2) maxMag2 = p;
    }
    if (maxMag2 === 0) return -1;

    const peakThreshold = maxMag2 * RELATIVE_PEAK_THRESHOLD;

    /**
     * Is there a *prominent* spectral peak near `freq` — a sharp local maximum
     * that stands well above the surrounding noise floor? A real (even weak)
     * harmonic is a sharp peak; low-frequency rumble and broadband mic noise are
     * not, so prominence is what distinguishes a true subharmonic partial from
     * the noise that sits under every low note. (Absolute thresholds can't: tune
     * them low enough to catch a weak fundamental and rumble sneaks through.)
     */
    const prominentPeakNear = (freq: number): boolean => {
      const center = Math.round(freq / df);
      const tb = Math.max(2, Math.round((HARMONIC_TOLERANCE * freq) / df));
      // Strongest local maximum in the tolerance band.
      let kp = -1;
      for (let k = Math.max(1, center - tb); k <= Math.min(half - 1, center + tb); k++) {
        if (mag2[k] >= mag2[k - 1] && mag2[k] >= mag2[k + 1] && (kp < 0 || mag2[k] > mag2[kp]))
          kp = k;
      }
      if (kp < 0 || mag2[kp] < maxMag2 * SUBHARMONIC_FLOOR) return false;
      // Median power of the local neighbourhood (excluding the peak) as the noise
      // floor. Median, not mean: it ignores the skirt of a nearby strong partial
      // (e.g. the fundamental one octave above the tested subharmonic), while
      // still rising under broadband rumble — so rumble peaks fail prominence.
      const wlo = Math.max(1, center - 6 * tb);
      const whi = Math.min(half - 1, center + 6 * tb);
      const neighbourhood: number[] = [];
      for (let k = wlo; k <= whi; k++) if (Math.abs(k - kp) > 1) neighbourhood.push(mag2[k]);
      neighbourhood.sort((a, b) => a - b);
      const floor = neighbourhood.length > 0 ? neighbourhood[neighbourhood.length >> 1] : 0;
      return mag2[kp] >= SUBHARMONIC_PROMINENCE * floor;
    };

    // Octave-error guard (a subharmonic check). YIN can lock onto the
    // 2nd harmonic when the fundamental is weak — common on a low E through a
    // phone mic that rolls off the bass. If the detected note is really a 2nd
    // harmonic, the spectrum shows a peak at f0/2 *and* at 1.5·f0 (the true
    // note's 3rd harmonic, an odd partial that a genuine fundamental lacks).
    // Both must be prominent, so a real low note (whose f0/2 region holds only
    // rumble) is never pushed down an octave.
    let f0Base = f0Seed;
    for (let i = 0; i < 2; i++) {
      const sub = f0Base / 2;
      if (sub < minFreq) break;
      if (prominentPeakNear(sub) && prominentPeakNear(1.5 * f0Base)) f0Base = sub;
      else break;
    }

    const tolBins = Math.max(1, Math.round((HARMONIC_TOLERANCE * f0Base) / df));
    // 튜너쓸말: 이번 프레임이 기준 음의 k배(옥타브 위 오독)로 읽혔으면 배음 h는 기준의 h·k번째다.
    const k = ref ? Math.round(f0Base / ref.f0) : 0;
    const refOk = ref !== null && k >= 1 && Math.abs(f0Base / ref.f0 - k) < 0.03 * k;

    let sumW = 0;
    let sumWFoverH = 0;
    // 고정 가중치로 잡힌 배음이 하나도 없으면 원래 방식으로 되돌아간다.
    let fixedW = 0;
    let fixedWFoverH = 0;

    const nyquist = sampleRate * 0.5;
    for (let h = 1; h <= MAX_HARMONICS; h++) {
      const expected = h * f0Base;
      if (expected > nyquist * 0.95) break;

      // Strongest local maximum within the tolerance band around h·f0.
      const center = Math.round(expected / df);
      let kp = -1;
      let best = peakThreshold;
      for (let k = Math.max(1, center - tolBins); k <= Math.min(half - 1, center + tolBins); k++) {
        if (mag2[k] > best && mag2[k] >= mag2[k - 1] && mag2[k] >= mag2[k + 1]) {
          best = mag2[k];
          kp = k;
        }
      }
      if (kp < 0) continue;

      // Sub-bin location via parabolic interpolation on the magnitude.
      const frac = parabolicOffset(mag2[kp - 1], mag2[kp], mag2[kp + 1]);
      let freqH = (kp + frac) * df;

      // Sharpen with the phase-difference instantaneous frequency, but only if
      // it stays within the bin's neighbourhood (guards against phase wrap noise
      // on weak peaks).
      const freqPhase = instantaneousFreq(kp, sampleRate);
      if (Number.isFinite(freqPhase) && Math.abs(freqPhase - freqH) < df) freqH = freqPhase;

      const mag = Math.sqrt(mag2[kp]);
      const w = aWeight(freqH) * mag;
      weights[h] = w;
      perH[h] = freqH / h;
      const rh = h * k;
      if (refOk && rh <= MAX_HARMONICS && ref.ratios[rh] > 0) {
        // 가중치는 지금 세기를 쓴다: 잡을 때 강했어도 지금 사라진 배음(잡음 피크)이 끌지 않게.
        fixedW += w;
        fixedWFoverH += (w * (freqH / h)) / ref.ratios[rh];
      }
      sumW += w;
      sumWFoverH += w * (freqH / h);
    }

    if (sumW === 0) return -1;
    const result = fixedW > 0 ? fixedWFoverH / fixedW : sumWFoverH / sumW;
    for (let h = 1; h <= MAX_HARMONICS; h++) if (perH[h] > 0) ratios[h] = perH[h] / result;
    lastF0 = result;
    return result;
  }

  /** Hann-window `len` samples of `buffer` starting at `offset` into re/im. */
  function transform(buffer: Float32Array, offset: number, re: Float32Array, im: Float32Array) {
    const m = fftSize;
    for (let i = 0; i < m; i++) {
      re[i] = buffer[offset + i] * window[i];
      im[i] = 0;
    }
    fft(re, im);
  }

  /**
   * Instantaneous frequency at bin `k` from the phase advance between the two
   * offset windows: actual advance minus the bin-centre's expected advance gives
   * the offset from the bin centre (the phase-vocoder estimator).
   */
  function instantaneousFreq(k: number, sampleRate: number): number {
    const m = fftSize;
    const phase1 = Math.atan2(im1[k], re1[k]);
    const phase2 = Math.atan2(im2[k], re2[k]);
    const expected = (2 * Math.PI * k * hop) / m;
    const dev = princarg(phase2 - phase1 - expected);
    const omega = (2 * Math.PI * k) / m + dev / hop; // radians per sample
    return (omega * sampleRate) / (2 * Math.PI);
  }

  /** 마지막 detect()의 배음 기준. 내부 버퍼라 보관하려면 복사해야 한다. */
  const lastHarmonics = (): Readonly<HarmonicRef> => ({ weights, ratios, f0: lastF0 });

  return { detect, lastHarmonics };
}

/** Half a length, floored — the YIN integration window. */
function n2(n: number): number {
  return n >> 1;
}

/** Sub-sample minimum location via parabolic interpolation around index `i`. */
function parabolicMin(arr: Float32Array, i: number): number {
  if (i <= 0 || i >= arr.length - 1) return i;
  const a = arr[i - 1];
  const b = arr[i];
  const c = arr[i + 1];
  const denom = a - 2 * b + c;
  if (denom <= 0) return i;
  return i + (0.5 * (a - c)) / denom;
}

/** Sub-bin peak offset in (-1, 1) for a maximum sampled at left/center/right. */
function parabolicOffset(left: number, center: number, right: number): number {
  const denom = left - 2 * center + right;
  if (denom >= 0) return 0; // not a clean peak
  return (0.5 * (left - right)) / denom;
}

/**
 * Relative A-weighting (linear, not dB) — human-hearing sensitivity curve.
 * Used to down-weight very low and very high harmonics so they don't bias the
 * averaged fundamental.
 */
function aWeight(f: number): number {
  const f2 = f * f;
  const num = 12194 * 12194 * f2 * f2;
  const den =
    (f2 + 20.6 * 20.6) *
    Math.sqrt((f2 + 107.7 * 107.7) * (f2 + 737.9 * 737.9)) *
    (f2 + 12194 * 12194);
  return den > 0 ? num / den : 0;
}
