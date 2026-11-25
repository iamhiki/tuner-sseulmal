import { LEVEL_TEXT } from "../app/tunerView.ts";
import type { LevelReading } from "../audio/inputLevel.ts";

/** F-04 입력 레벨: 너무 작음 · 적정 · 과입력 구역이 있는 막대. */
export function InputLevelMeter({ level }: { level: LevelReading }) {
  const pct = Math.round(level.bar * 100);
  return (
    <div class="lvl">
      <div class="cap">입력 레벨</div>
      <div class="st" role="status">
        {LEVEL_TEXT[level.state]}
      </div>
      <div class="bar" aria-hidden="true">
        <div class={`fill${level.state === "clip" ? " hot" : ""}`} style={{ width: `${pct}%` }} />
      </div>
      <div class="zones" aria-hidden="true">
        <span>너무 작음</span>
        <span>적정</span>
        <span>과입력</span>
      </div>
    </div>
  );
}

/** 장치 목록 옆 작은 막대 6개. */
export function MiniMeter({ bar, active }: { bar: number; active: boolean }) {
  const on = active ? Math.ceil(bar * 6) : 0;
  return (
    <span class="meter" aria-hidden="true">
      {Array.from({ length: 6 }, (_, i) => (
        <i
          key={i}
          class={i < on ? (i >= 5 ? "hot" : "on") : ""}
          style={{ height: `${8 + i * 3}px` }}
        />
      ))}
    </span>
  );
}
