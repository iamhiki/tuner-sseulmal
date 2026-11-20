import { bassTuning } from "../lib/bass";

/**
 * 0단계 빈 앱. 엔진이 이식됐는지 보여주는 자리만 있다.
 * 장치 선택(1단계)과 레벨 미터(2단계)가 여기에 붙는다.
 */
export function App() {
  return (
    <main class="shell">
      <h1>튜너쓸말</h1>
      <p class="tagline">튜너 쓸래, 말래?</p>
      <ul class="strings" aria-label="4현 표준 튜닝">
        {bassTuning.strings.map((s) => (
          <li key={`${s.name}${s.octave}`}>
            <strong>{`${s.name}${s.octave}`}</strong>
            <span>{s.freq.toFixed(2)} Hz</span>
          </li>
        ))}
      </ul>
      <p class="status">준비 중이에요. 다음 단계에서 오인페를 고를 수 있어요.</p>
    </main>
  );
}
