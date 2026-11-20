import { type Note, type Tuning, tuningNotes } from "./notes.ts";

/**
 * 베이스 검출 범위 (Hz). 실제 기본음 범위로 좁혀야 옥타브 오검출이 줄어든다.
 * 값은 fgnass/tuner의 베이스 설정을 따른다 (B0 ≈ 30.9Hz 아래까지 여유).
 */
export const BASS_RANGE = { min: 28, max: 450 } as const;

export const BASS_TUNINGS: Tuning[] = [
  { id: "bass-standard", name: "4현 표준", strings: ["E1", "A1", "D2", "G2"] },
];

export interface ResolvedTuning {
  id: string;
  name: string;
  strings: Note[];
}

function resolve(tuning: Tuning): ResolvedTuning {
  return { id: tuning.id, name: tuning.name, strings: tuningNotes(tuning) };
}

/** MVP 기본 튜닝: E1 · A1 · D2 · G2 */
export const bassTuning: ResolvedTuning = resolve(BASS_TUNINGS[0]);
