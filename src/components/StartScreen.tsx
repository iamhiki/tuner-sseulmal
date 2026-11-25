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
/**
 * 처음 열면 쓸말이가 하는 말. 열 때마다 하나를 고른다. 고양이다운 하찮은 한마디로,
 * 덩어리마다 말풍선에서 한 줄로 묶는다.
 */
export const WELCOME_SAYS: readonly (readonly string[])[] = [
  ["방금 낮잠 깼어.", "천천히 해도 돼"],
  ["귀 하나는 좋아.", "나머지는 묻지 마"],
  ["츄르 대신", "저음 줘"],
  ["난 발바닥뿐이라", "줄은 네가 감아"],
  ["줄 튕기면", "귀 쫑긋할게"],
  ["낮은 소리 좋아해.", "골골송이랑 비슷하거든"],
  ["꼬리로", "박자 세는 중이었어"],
];
/** 자리 계산에 쓰는 말래 버튼 폭 (가장 긴 문구 "선택권은 없습니다" 기준, 여유 포함). */
const NOPE_BOX_W = 190;
/** 말래가 사라지면 쓸말이가 하는 말. 뒷부분은 말풍선에서 한 줄로 묶는다. */
export const NOPE_GONE_SAY = ["당신은 이 웹을", "무조건 써야 합니다 ㅋ"] as const;

/** 쫓을수록 약 오르는 쓸말이: 갸웃 → 까치발 → 사라지면 만세. (빠르게 떠는 포즈는 어지러워서 안 씀) */
export function nopePose(dodges: number): Pose {
  if (dodges >= NOPE_LABELS.length) return "intune";
  if (dodges >= NOPE_LABELS.length - 2) return "sharp";
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
 * avoid(쓸래 버튼·글씨·쓸말이)와 겹치지 않는 곳 중에서, 지금 자리에서 화면 짧은 변의 40%
 * (최소 160px) 넘게 떨어진 곳. 그런 곳이 없으면(좁은 화면) 안 겹치는 곳 중 가장 먼 곳.
 * @param home 버튼의 원래 자리 (이동 전 위치, 화면 좌표)
 * @param rand 0~1 난수 (테스트에서 고정)
 */
export function nextDodge(
  home: Box,
  viewW: number,
  viewH: number,
  prev: { x: number; y: number },
  avoid: readonly Box[] = [],
  rand: () => number = Math.random,
): { x: number; y: number } {
  const margin = 12;
  const gap = 14;
  const w = home.right - home.left;
  const h = home.bottom - home.top;
  const minJump = Math.max(160, 0.4 * Math.min(viewW, viewH));
  const now = { left: home.left + prev.x, top: home.top + prev.y };
  const covers = (left: number, top: number) =>
    avoid.some(
      (a) =>
        left < a.right + gap &&
        left + w > a.left - gap &&
        top < a.bottom + gap &&
        top + h > a.top - gap,
    );
  let best: { left: number; top: number; d: number } | null = null;
  let fallback = { left: now.left, top: now.top, d: -1 };
  for (let i = 0; i < 80; i++) {
    const left = margin + rand() * Math.max(0, viewW - 2 * margin - w);
    const top = margin + rand() * Math.max(0, viewH - 2 * margin - h);
    const d = Math.hypot(left - now.left, top - now.top);
    if (covers(left, top)) {
      if (!best && d > fallback.d) fallback = { left, top, d }; // 빈 곳이 아예 없을 때만 쓴다
      continue;
    }
    if (d >= minJump) return { x: left - home.left, y: top - home.top };
    if (!best || d > best.d) best = { left, top, d };
  }
  const to = best ?? fallback;
  return { x: to.left - home.left, y: to.top - home.top };
}

/** 말풍선 문구를 덩어리마다 한 줄로 묶어 둔다 (어색한 데서 줄이 안 바뀌게). */
function sayChunks(chunks: readonly string[] | null) {
  if (!chunks) return undefined;
  return chunks.flatMap((c, i) => [
    i > 0 ? " " : "",
    <span key={c} class="nb">
      {c}
    </span>,
  ]);
}

/**
 * F-01 시작 (권한 요청 전). 이름은 "쓸래말래"지만 목적은 쓰게 하는 것:
 * "말래"는 다가가면 도망치며 작아지고, 그만큼 "쓸래"가 커진다. 다섯 번째에 말래는 펑 사라진다.
 * "쓸래"는 언제든 누를 수 있으니 갇히는 사람은 없다.
 */
export function StartScreen({ busy, onStart }: { busy: boolean; onStart: () => void }) {
  const [dodges, setDodges] = useState(0);
  const [welcome] = useState(() => WELCOME_SAYS[Math.floor(Math.random() * WELCOME_SAYS.length)]);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const nope = useRef<HTMLButtonElement>(null);
  /** 처음 도망칠 때의 자리 (.btns 기준). 그 뒤로는 버튼 줄에서 빠져 이 자리를 기준으로 움직인다. */
  const [anchor, setAnchor] = useState<{ left: number; top: number } | null>(null);
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
    // 원래 자리는 레이아웃 위치(offset)로 잰다. 화면 위치(getBoundingClientRect)는 이동 애니메이션
    // 도중이면 중간값이라, 움직이는 버튼에 마우스가 다시 닿으면 화면 밖으로 튕겨 나갔다.
    // 처음 도망칠 때 버튼 줄에서 빼낸다: 문구가 길어져 줄이 바뀌어도 원래 자리가 흔들리지 않게.
    const at = anchor ?? { left: el.offsetLeft, top: el.offsetTop };
    if (!anchor) setAnchor(at);
    const parent = (el.offsetParent ?? document.body).getBoundingClientRect();
    const left = parent.left + at.left;
    const top = parent.top + at.top;
    // 문구가 바뀌면 폭도 바뀌니 가장 긴 문구만큼 넉넉하게 잡는다.
    const home = {
      left,
      top,
      right: left + Math.max(el.offsetWidth, NOPE_BOX_W),
      bottom: top + el.offsetHeight,
    };
    // 피할 곳: 쓸래 버튼, 쓸말이·말풍선, 제목·안내문, 상단 로고
    const avoid = [
      ...document.querySelectorAll(".solo .go, .solo-cat, .solo h1, .solo p, .logo"),
    ].map((n) => n.getBoundingClientRect());
    setPos(nextDodge(home, innerWidth, innerHeight, pos, avoid));
    setDodges(dodges + 1);
  };

  return (
    <Solo
      pose={nopePose(dodges)}
      title="튜너 쓸래말래"
      // 쫓는 동안에도 말풍선을 그대로 둔다: 사라지면 카드 높이가 바뀌어 화면이 출렁인다.
      say={sayChunks(gone ? NOPE_GONE_SAY : welcome)}
    >
      <p>
        오인페에 베이스 꽂았으면 <span class="nb">시작 눌러줘.</span>
        <br />
        브라우저가 입력 권한을 <span class="nb">물어볼 거야.</span>
        <br />
        소리는 이 브라우저 밖으로 <span class="nb">절대 안 나가.</span>
      </p>
      <div class="btns start-btns">
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
          style={{
            translate: `${pos.x}px ${pos.y}px`,
            scale: `${1 - dodges * 0.12}`,
            ...(anchor && {
              position: "absolute",
              left: `${anchor.left}px`,
              top: `${anchor.top}px`,
            }),
          }}
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
