import { formatCents, rulerPercent, type TunerView } from "../app/tunerView.ts";
import type { PitchReading } from "../audio/pitchPipeline.ts";
import type { Note } from "../lib/notes.ts";
import { Mascot } from "./Mascot.tsx";

const TICKS = Array.from({ length: 21 }, (_, i) => -50 + i * 5);

/** F-06 음정 표시: 음 이름 · Hz · 센트 + 센트 자 위를 걷는 쓸말이. */
export function TunerDisplay({
  pitch,
  view,
  target,
}: {
  pitch: PitchReading;
  view: TunerView;
  /** 목표 줄 (확정 전에는 직전/고정 줄, 없으면 null). */
  target: Note | null;
}) {
  const pos = view.blank ? 50 : rulerPercent(pitch.cents);
  const note = pitch.note;
  return (
    <>
      <div class={`read t-${view.tone}`}>
        <div>
          <div class="cap">음 이름</div>
          <div class="note num">
            {view.blank || !note ? (
              <span class="wait">대기</span>
            ) : (
              <>
                {note.name}
                <sub>{note.octave}</sub>
              </>
            )}
          </div>
        </div>
        <div class="mid">
          <div class="cap">주파수</div>
          <div class="hz num">
            {view.blank ? (
              <span class="wait">아직 없음</span>
            ) : (
              <>
                {pitch.freq.toFixed(2)} <span>Hz</span>
              </>
            )}
          </div>
          {target && (
            <div class="target">
              목표 {`${target.name}${target.octave}`} · {target.freq.toFixed(2)} Hz
            </div>
          )}
        </div>
        <div class="cents">
          <div class="cap">센트(¢) 차이</div>
          <div class="v num">
            {view.blank ? <span class="wait">{view.waitWord}</span> : formatCents(pitch.cents)}
          </div>
          <div class="lab">{view.centsLabel}</div>
        </div>
      </div>

      <div class="track">
        {view.showCableHint && (
          <div class="hint">
            <b>케이블 꽂았어?</b>
            <ol>
              <li>베이스 ↔ 오인페 케이블 확인</li>
              <li>오인페 게인 노브 조금 올리기</li>
              <li>장치가 맞는지 아래에서 확인</li>
            </ol>
          </div>
        )}
        <div class="center" aria-hidden="true" />
        <div class="pin" style={{ left: `${pos}%` }} />
        <div class="walker" style={{ left: `${pos}%` }}>
          <div class="bubble" aria-live="polite">
            {view.say}
          </div>
          <div class={`anim a-${view.pose}`}>
            <Mascot pose={view.pose} size={190} />
          </div>
        </div>
        <div class="scale" aria-hidden="true">
          <div class="zone" />
          {TICKS.map((c) => (
            <div key={c}>
              <div class={`tick${c % 25 === 0 ? " big" : ""}`} style={{ left: `${c + 50}%` }} />
              {c % 25 === 0 && (
                <div class="tl num" style={{ left: `${c + 50}%` }}>
                  {c > 0 ? `+${c}` : c}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      <div class="flatsharp" aria-hidden="true">
        <span>♭ 낮아요, 감아줘</span>
        <span>높아요, 풀어줘 ♯</span>
      </div>
    </>
  );
}
