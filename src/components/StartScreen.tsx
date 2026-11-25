import { useRef, useState } from "preact/hooks";
import type { Pose } from "./Mascot.tsx";
import { Solo } from "./Solo.tsx";

/** 도망칠 때마다 바뀌는 "말래" 버튼 문구. 다 쓰면 버튼이 펑 사라진다 (절대 안 눌린다). */
export const NOPE_LABELS = [
  "말래…",
  "그건 장식이에요",
  "선택권은 없습니다",
  "쓸래밖에 없어요",
  "마지막 경고",
];
/** 말래가 사라지면 쓸말이가 하는 말. 뒷부분은 말풍선에서 한 줄로 묶는다. */
export const NOPE_GONE_SAY = ["당신은 이 웹을", "무조건 써야 합니다 ㅋ"] as const;

/** 쫓을수록 격해지는 쓸말이: 갸웃 → 까치발(약 오름) → 부들부들 → 사라지면 만세. */
export function nopePose(dodges: number): Pose {
  if (dodges >= NOPE_LABELS.length) return "intune";
  if (dodges === NOPE_LABELS.length - 1) return "clip";
  if (dodges === NOPE_LABELS.length - 2) return "sharp";
  return dodges > 0 ? "unsure" : "idle";
}

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * 다음 도망 위치 (원래 자리 기준 translate px). 화면 안 아무 곳으로 크게 점프한다:
 * 지금 자리에서 화면 짧은 변의 40%(최소 160px) 넘게 떨어지고, avoid(쓸래 버튼)와 겹치지 않는 곳.
 * @param home 버튼의 원래 자리 (이동 전 위치, 화면 좌표)
 * @param rand 0~1 난수 (테스트에서 고정)
 */
export function nextDodge(
  home: Box,
  viewW: number,
  viewH: number,
  prev: { x: number; y: number },
  avoid: Box | null = null,
  rand: () => number = Math.random,
): { x: number; y: number } {
  const margin = 12;
  const w = home.right - home.left;
  const h = home.bottom - home.top;
  const minJump = Math.max(160, 0.4 * Math.min(viewW, viewH));
  const now = { left: home.left + prev.x, top: home.top + prev.y };
  const hitsAvoid = (left: number, top: number) =>
    avoid !== null &&
    left < avoid.right + 16 &&
    left + w > avoid.left - 16 &&
    top < avoid.bottom + 16 &&
    top + h > avoid.top - 16;
  let best = { left: now.left, top: now.top, d: -1 };
  for (let i = 0; i < 24; i++) {
    const left = margin + rand() * Math.max(0, viewW - 2 * margin - w);
    const top = margin + rand() * Math.max(0, viewH - 2 * margin - h);
    if (hitsAvoid(left, top)) continue;
    const d = Math.hypot(left - now.left, top - now.top);
    if (d >= minJump) return { x: left - home.left, y: top - home.top };
    if (d > best.d) best = { left, top, d }; // 좁은 화면이면 그나마 가장 먼 곳
  }
  return { x: best.left - home.left, y: best.top - home.top };
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
    const g = go.current?.getBoundingClientRect() ?? null;
    setPos(nextDodge(home, innerWidth, innerHeight, pos, g));
    setDodges(dodges + 1);
  };

  return (
    <Solo
      pose={nopePose(dodges)}
      title="튜너 쓸래말래"
      say={
        gone && (
          <>
            <span class="nb">{NOPE_GONE_SAY[0]}</span> <span class="nb">{NOPE_GONE_SAY[1]}</span>
          </>
        )
      }
    >
      <p>
        오인페에 베이스 꽂았으면 <span class="nb">시작 눌러줘.</span>
        <br />
        브라우저가 입력 권한을 <span class="nb">물어볼 거야.</span>
        <br />
        소리는 이 브라우저 밖으로 <span class="nb">절대 안 나가.</span>
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
      <p class="tiny">
        로그인도 설치도 없어.
        <br />
        <span class="nb">Chrome · Edge · Safari · Firefox</span> <span class="nb">최신 버전</span>
      </p>
    </Solo>
  );
}
