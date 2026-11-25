import { batch, signal } from "@preact/signals";
import { useEffect } from "preact/hooks";
import { IN_TUNE_CENTS } from "../app/tunerView.ts";
import { type LevelReading, LevelTracker } from "../audio/inputLevel.ts";
import { PitchPipeline, type PitchReading } from "../audio/pitchPipeline.ts";
import { bassTuning } from "../lib/bass.ts";
import { currentId, engine } from "./useAudioInput.ts";

const EMPTY_LEVEL: LevelReading = {
  rmsDb: Number.NEGATIVE_INFINITY,
  peakDb: Number.NEGATIVE_INFINITY,
  peakHoldDb: Number.NEGATIVE_INFINITY,
  state: "none",
  bar: 0,
  clipCount: 0,
};
const EMPTY_PITCH: PitchReading = {
  status: "silent",
  freq: -1,
  note: null,
  stringIndex: -1,
  cents: 0,
};

export const level = signal<LevelReading>(EMPTY_LEVEL);
export const pitch = signal<PitchReading>(EMPTY_PITCH);
/** 레벨이 "신호 없음"으로 이어진 시간 (ms). */
export const quietMs = signal(0);
/** 직접 고른 줄. null이면 가까운 줄 자동. */
export const lockedString = signal<number | null>(null);
/** 이번에 맞춘 줄들. */
export const tunedStrings = signal<ReadonlySet<number>>(new Set());

const pipeline = new PitchPipeline(bassTuning.strings);
const tracker = new LevelTracker();

export function toggleString(index: number): void {
  const next = lockedString.value === index ? null : index;
  lockedString.value = next;
  pipeline.setLockedString(next);
  pipeline.reset();
}

/**
 * 입력이 연결돼 있는 동안 매 프레임(약 60fps) 레벨과 음정을 갱신한다.
 * 장치가 바뀌면 필터 상태를 초기화한다.
 */
export function usePitchLoop(): void {
  useEffect(() => {
    let raf = 0;
    let quietSince = performance.now();
    let lastDevice: string | null = null;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      const now = performance.now();
      if (currentId.value !== lastDevice) {
        lastDevice = currentId.value;
        pipeline.reset();
        tracker.reset();
        tunedStrings.value = new Set();
        quietSince = now;
      }
      if (!engine.read()) {
        if (pitch.value !== EMPTY_PITCH)
          batch(() => {
            level.value = EMPTY_LEVEL;
            pitch.value = EMPTY_PITCH;
          });
        return;
      }
      const lv = tracker.update(engine.levelBuf, now);
      const p = pipeline.process(engine.pitchBuf, engine.sampleRate, now);
      if (lv.state !== "none") quietSince = now;
      batch(() => {
        level.value = lv;
        pitch.value = p;
        quietMs.value = now - quietSince;
        if (
          p.status === "ok" &&
          lv.state !== "clip" &&
          Math.abs(p.cents) <= IN_TUNE_CENTS &&
          !tunedStrings.value.has(p.stringIndex)
        )
          tunedStrings.value = new Set([...tunedStrings.value, p.stringIndex]);
      });
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);
}
