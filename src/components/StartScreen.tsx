import { useRef, useState } from "preact/hooks";
import { Solo } from "./Solo.tsx";

/** 도망칠 때마다 바뀌는 "말래" 버튼 문구. 끝까지 가면 뒤쪽 문구를 돌려 쓴다 (절대 안 눌린다). */
export const NOPE_LABELS = [
  "말래…",
  "어딜!",
  "진짜 말래?",
  "한 줄만 튕겨 봐",
  "잡아 봐~",
  "안 잡히지롱",
  "쓸래 눌러줘…",
];
/** 처음 두 문구 뒤로는 이 위치부터 돌려 쓴다. */
const NOPE_LOOP_FROM = 2;

export function nopeLabel(dodges: number): string {
  if (dodges < NOPE_LABELS.length) return NOPE_LABELS[dodges];
  const loop = NOPE_LABELS.length - NOPE_LOOP_FROM;
  return NOPE_LABELS[NOPE_LOOP_FROM + ((dodges - NOPE_LOOP_FROM) % loop)];
}

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
 * F-01 시작 (권한 요청 전). "말래"는 절대 안 눌린다: 다가가면 도망치고 문구만 바뀐다.
 * 이름은 "쓸래말래"지만 목적은 쓰게 하는 것. "쓸래"는 언제든 누를 수 있으니 갇히는 사람은 없다.
 */
export function StartScreen({ busy, onStart }: { busy: boolean; onStart: () => void }) {
  const [dodges, setDodges] = useState(0);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const nope = useRef<HTMLButtonElement>(null);

  const dodge = () => {
    const el = nope.current;
    if (!el) return;
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
    <Solo pose={dodges > 0 ? "unsure" : "idle"} title="튜너 쓸래말래">
      <p>
        오인페에 베이스 꽂았으면 시작 눌러줘.
        <br />
        브라우저가 입력 권한을 물어볼 거야. 소리는 이 브라우저 밖으로 절대 안 나가.
      </p>
      <div class="btns">
        <button type="button" class="btn" onClick={onStart} disabled={busy}>
          쓸래! 시작
        </button>
        <button
          ref={nope}
          type="button"
          class="btn ghost nope"
          style={{ translate: `${pos.x}px ${pos.y}px` }}
          onPointerEnter={(e) => e.pointerType === "mouse" && dodge()}
          onClick={dodge}
        >
          {nopeLabel(dodges)}
        </button>
      </div>
      <p class="tiny">
        로그인도 설치도 없어.
        <br />
        Chrome · Edge · Safari · Firefox 최신 버전
      </p>
    </Solo>
  );
}
