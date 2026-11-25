import { useRef, useState } from "preact/hooks";
import { Solo } from "./Solo.tsx";

/** 도망칠 때마다 바뀌는 "말래" 버튼 문구. 다 쓰면 버튼이 펑 사라진다 (절대 안 눌린다). */
export const NOPE_LABELS = [
  "말래…",
  "어림없지",
  "선택권은 없습니다",
  "쓸래밖에 없어요",
  "마지막 경고",
];
/** 말래가 사라진 자리에 남는 손글씨 메모. */
export const NOPE_GONE_NOTE = "당신은 이 웹을 무조건 써야 합니다 ㅋ";

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * 다음 도망 위치 (원래 자리 기준 px). 원래 자리에서 70~170px 떨어진 곳을 고르고,
 * 화면 밖으로 나가지 않게 자른다.
 * @param home 버튼의 원래 자리 (이동 전 위치)
 * @param rand 0~1 난수 (테스트에서 고정)
 */
export function nextDodge(
  home: Box,
  viewW: number,
  viewH: number,
  prev: { x: number; y: number },
  rand: () => number = Math.random,
): { x: number; y: number } {
  const margin = 8;
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const pick = () => (rand() < 0.5 ? -1 : 1) * (70 + rand() * 100);
  // 직전 자리와 너무 가까우면 다시 고른다 (같은 자리에서 꿈틀대면 도망친 것 같지 않다).
  for (let i = 0; i < 6; i++) {
    const x = clamp(pick(), margin - home.left, viewW - margin - home.right);
    const y = clamp(pick() * 0.6, margin - home.top, viewH - margin - home.bottom);
    if (Math.hypot(x - prev.x, y - prev.y) > 60 || i === 5) return { x, y };
  }
  return prev;
}

/**
 * F-01 시작 (권한 요청 전). 이름은 "쓸래말래"지만 목적은 쓰게 하는 것:
 * "말래"는 다가가면 도망치며 작아지고, 그만큼 "쓸래"가 커진다. 다섯 번째에 말래는 펑 사라진다.
 * "쓸래"는 언제든 누를 수 있으니 갇히는 사람은 없다.
 */
export function StartScreen({ busy, onStart }: { busy: boolean; onStart: () => void }) {
  const [dodges, setDodges] = useState(0);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const nope = useRef<HTMLButtonElement>(null);
  const go = useRef<HTMLButtonElement>(null);
  const gone = dodges >= NOPE_LABELS.length;

  const dodge = () => {
    const el = nope.current;
    if (!el || gone) return;
    if (dodges + 1 >= NOPE_LABELS.length) {
      setDodges(dodges + 1);
      go.current?.focus(); // 사라지는 버튼에 있던 포커스를 남은 버튼으로
      return;
    }
    const r = el.getBoundingClientRect();
    const home = {
      left: r.left - pos.x,
      top: r.top - pos.y,
      right: r.right - pos.x,
      bottom: r.bottom - pos.y,
    };
    setPos(nextDodge(home, innerWidth, innerHeight, pos));
    setDodges(dodges + 1);
  };

  return (
    <Solo pose={gone ? "intune" : dodges > 0 ? "unsure" : "idle"} title="튜너 쓸래말래">
      <p>
        오인페에 베이스 꽂았으면 시작 눌러줘.
        <br />
        브라우저가 입력 권한을 물어볼 거야. 소리는 이 브라우저 밖으로 절대 안 나가.
      </p>
      <div class="btns">
        <button
          ref={go}
          type="button"
          class="btn go"
          style={{ "--grow": dodges }}
          onClick={onStart}
          disabled={busy}
        >
          쓸래! 시작
        </button>
        <button
          ref={nope}
          type="button"
          class={`btn ghost nope${gone ? " gone" : ""}`}
          style={{ translate: `${pos.x}px ${pos.y}px`, scale: `${1 - dodges * 0.12}` }}
          tabIndex={gone ? -1 : undefined}
          aria-hidden={gone}
          onPointerEnter={(e) => e.pointerType === "mouse" && dodge()}
          onClick={dodge}
        >
          {gone ? "펑!" : NOPE_LABELS[dodges]}
        </button>
      </div>
      {gone && (
        <p class="pen-note" role="status">
          <span>{NOPE_GONE_NOTE}</span>
        </p>
      )}
      <p class="tiny">
        로그인도 설치도 없어.
        <br />
        Chrome · Edge · Safari · Firefox 최신 버전
      </p>
    </Solo>
  );
}
