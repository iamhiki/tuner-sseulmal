import type { Note } from "../lib/notes.ts";

/** F-07 줄 선택 (E·A·D·G). 기본은 가까운 줄 자동, 누르면 그 줄로 고정, 다시 누르면 자동. */
export function TuningPreset({
  strings,
  current,
  locked,
  tuned,
  onToggle,
}: {
  strings: Note[];
  /** 지금 목표 줄 (없으면 -1). */
  current: number;
  locked: number | null;
  tuned: ReadonlySet<number>;
  onToggle: (index: number) => void;
}) {
  return (
    <fieldset class="strings">
      <legend class="sr-only">목표 줄</legend>
      {strings.map((s, i) => {
        const now = i === (locked ?? current);
        const done = tuned.has(i);
        return (
          <button
            type="button"
            key={`${s.name}${s.octave}`}
            class={`str${done && !now ? " done" : ""}`}
            aria-pressed={locked === i}
            data-now={now}
            onClick={() => onToggle(i)}
          >
            <b class="num">{`${s.name}${s.octave}`}</b>
            <span class="num">{s.freq.toFixed(2)}</span>
            {done && <span class="ck">✓ 맞춤</span>}
          </button>
        );
      })}
      <span class="auto">
        {locked === null
          ? "자동으로 가까운 줄을 골라요 · 맞춘 줄은 초록"
          : "이 줄만 봐요 · 한 번 더 누르면 자동"}
      </span>
    </fieldset>
  );
}
