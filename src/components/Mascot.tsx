/**
 * 쓸말이 v2: 하찮은 낙서 고양이. 꼬리 끝이 줄감개다.
 * 승인된 시안(Figma "Mascot / 쓸말이", 7포즈)의 선을 그대로 옮겼다.
 * idle 기다림 · flat 축 처짐(♭) · sharp 까치발(♯) · intune 만세(±4¢)
 * · sleep 쿨쿨(신호 없음) · clip 귀 막기(과입력) · unsure 갸우뚱(불안정)
 */
import type { JSX } from "preact";

export type Pose = "idle" | "flat" | "sharp" | "intune" | "sleep" | "clip" | "unsure";
export const POSES: Pose[] = ["idle", "flat", "sharp", "intune", "sleep", "clip", "unsure"];

const INK = "#1E1A17";
const PAPER = "#FFFFFF";
const ACC = "#FF6A3D";
const SKY = "#8FD0FF";
const SW = 6.5;

type El = JSX.Element;

const L = (d: string, w = SW, c = INK, o?: number): El => (
  <path
    d={d}
    fill="none"
    stroke={c}
    stroke-width={w}
    stroke-linecap="round"
    stroke-linejoin="round"
    stroke-opacity={o}
  />
);
const dot = (x: number, y: number, r: number): El => <circle cx={x} cy={y} r={r} fill={INK} />;
/** 색이 선 밖으로 살짝 삐져나간 동그라미. */
const blob = (x: number, y: number, r: number, c: string): El => (
  <>
    <circle cx={x + 3} cy={y + 3} r={r} fill={c} />
    <circle cx={x} cy={y} r={r} fill="none" stroke={INK} stroke-width={5} />
  </>
);

const HEAD = {
  up: {
    fill: "M66 118 C62 96 64 72 72 52 L76 40 Q80 34 86 40 L104 62 Q118 66 132 60 L146 38 Q151 32 156 38 C164 52 172 62 176 74 L178 80 C190 92 186 120 170 134 C150 150 92 152 74 136 C66 128 64 122 66 118 Z",
    line: "M66 118 C62 96 64 72 72 52 L76 40 Q80 34 86 40 L104 62 Q118 66 132 60 L146 38 Q151 32 156 38 C164 52 172 62 175 72 M179 81 C190 92 186 120 170 134 C150 150 92 152 74 136 C66 128 64 122 66 118",
  },
  droop: {
    fill: "M66 118 C62 100 64 86 70 76 L52 64 Q48 58 56 58 L100 66 Q118 70 134 64 L180 56 Q190 56 186 62 L174 78 L178 84 C190 96 186 120 170 134 C150 150 92 152 74 136 C66 128 64 122 66 118 Z",
    line: "M66 118 C62 100 64 86 70 76 L52 64 Q48 58 56 58 L100 66 Q118 70 134 64 L180 56 Q190 56 186 62 L175 76 M179 85 C190 96 186 120 170 134 C150 150 92 152 74 136 C66 128 64 122 66 118",
  },
};

const WHISK = (
  <>
    {L("M70 106 L46 102", 5)}
    {L("M69 117 L48 122", 5)}
    {L("M73 127 L56 140", 5)}
    {L("M180 102 L204 96", 5)}
    {L("M182 113 L206 115", 5)}
    {L("M178 124 L198 134", 5)}
  </>
);

const EYES: Record<string, El> = {
  dot: (
    <>
      {dot(100, 104, 4.3)}
      {dot(144, 102, 4.3)}
    </>
  ),
  wide: (
    <>
      {dot(99, 102, 6.5)}
      {dot(145, 100, 6.5)}
    </>
  ),
  happy: (
    <>
      {L("M91 107 L100 98 L109 107", 5)}
      {L("M135 105 L144 96 L153 105", 5)}
    </>
  ),
  closed: (
    <>
      {L("M91 104 L109 106", 5)}
      {L("M135 103 L153 101", 5)}
    </>
  ),
  squeeze: (
    <>
      {L("M92 96 L107 104 L92 112", 5)}
      {L("M152 94 L137 102 L152 110", 5)}
    </>
  ),
  worried: (
    <>
      {dot(100, 106, 4)}
      {dot(144, 104, 4)}
      {L("M88 95 L106 87", 4.5)}
      {L("M156 93 L138 86", 4.5)}
    </>
  ),
  unsure: (
    <>
      {dot(100, 104, 4.3)}
      {L("M137 102 L152 102", 5)}
    </>
  ),
};

const MOUTH: Record<string, El> = {
  w: L("M110 114 Q112 126 121 118 Q129 126 134 114", 5),
  open: (
    <path
      d="M110 114 Q122 136 134 113 Z"
      fill={INK}
      stroke={INK}
      stroke-width={5}
      stroke-linejoin="round"
    />
  ),
  frown: L("M110 124 Q114 115 121 121 Q128 115 133 124", 5),
  o: <ellipse cx={122} cy={121} rx={5} ry={6} fill="none" stroke={INK} stroke-width={4.5} />,
  zig: L("M106 120 L112 114 L118 120 L124 114 L130 120 L135 115", 4.5),
  flat: L("M113 120 L131 119", 5),
  sleep: L("M114 118 Q122 124 130 118", 4.5),
};

const BODY = (
  <>
    <path d="M88 140 C78 168 80 198 92 208 L150 208 C162 196 162 166 154 140 Z" fill={PAPER} />
    {L("M88 140 C78 168 80 198 92 208 L150 208 C161 197 162 168 155 142")}
  </>
);

const LEGS: Record<string, El | null> = {
  norm: (
    <>
      {L("M102 208 L100 220")}
      {L("M140 208 L142 220")}
    </>
  ),
  splay: (
    <>
      {L("M98 208 L90 218")}
      {L("M144 208 L152 218")}
    </>
  ),
  tip: null,
  none: null,
};

const ARMS: Record<string, El | null> = {
  rest: (
    <>
      {L("M88 158 L78 176")}
      {L("M155 158 L165 176")}
    </>
  ),
  up: (
    <>
      {L("M86 158 Q48 156 34 116")}
      {L("M156 156 Q196 152 208 114")}
    </>
  ),
  ears: (
    <>
      {L("M88 152 Q62 132 64 104")}
      {L("M154 152 Q180 132 180 102")}
      <ellipse cx={64} cy={98} rx={10} ry={12} fill={PAPER} stroke={INK} stroke-width={5} />
      <ellipse cx={180} cy={96} rx={10} ry={12} fill={PAPER} stroke={INK} stroke-width={5} />
    </>
  ),
  chin: (
    <>
      {L("M88 158 L78 176")}
      {L("M154 152 Q166 138 142 130")}
    </>
  ),
  flail: (
    <>
      {L("M88 150 L62 128")}
      {L("M154 150 L182 124")}
    </>
  ),
  none: null,
};

/** [꼬리 경로, 줄감개 x, 줄감개 y] */
const TAILS: Record<string, [string, number, number]> = {
  up: ["M156 200 Q200 200 198 160", 198, 150],
  curl: ["M156 200 Q210 196 204 150 Q200 132 186 138", 178, 142],
  down: ["M156 204 Q190 214 212 210", 222, 210],
  tall: ["M156 196 Q188 188 190 118", 190, 108],
  wrap: ["M160 210 Q186 224 150 226 L100 226", 90, 226],
  spike: ["M156 198 L176 186 L168 172 L188 160 L180 144 L194 130", 196, 120],
};

interface PoseSpec {
  head: keyof typeof HEAD;
  eyes: string;
  mouth: string;
  tail: string;
  arms: string;
  legs: string;
  /** 머리 transform */
  ht?: string;
  /** 몸 transform */
  bt?: string;
}

const P: Record<Pose, PoseSpec> = {
  idle: { head: "up", eyes: "dot", mouth: "w", tail: "up", arms: "rest", legs: "norm" },
  flat: {
    head: "droop",
    eyes: "worried",
    mouth: "frown",
    tail: "down",
    arms: "rest",
    legs: "splay",
    ht: "translate(0 14) rotate(-5 120 140)",
    bt: "translate(120 220) scale(1.1 0.86) translate(-120 -220)",
  },
  sharp: {
    head: "up",
    eyes: "wide",
    mouth: "o",
    tail: "tall",
    arms: "flail",
    legs: "tip",
    ht: "translate(0 -18)",
    bt: "translate(0 -18)",
  },
  intune: {
    head: "up",
    eyes: "happy",
    mouth: "open",
    tail: "curl",
    arms: "up",
    legs: "norm",
    ht: "rotate(6 120 150)",
  },
  sleep: {
    head: "droop",
    eyes: "closed",
    mouth: "sleep",
    tail: "wrap",
    arms: "none",
    legs: "none",
    ht: "translate(0 30)",
    bt: "translate(120 220) scale(1.14 0.78) translate(-120 -220)",
  },
  clip: { head: "up", eyes: "squeeze", mouth: "zig", tail: "spike", arms: "ears", legs: "norm" },
  unsure: {
    head: "up",
    eyes: "unsure",
    mouth: "flat",
    tail: "up",
    arms: "chin",
    legs: "norm",
    ht: "rotate(-12 120 150)",
  },
};

const BLUSH = (
  <>
    {L("M84 120 L80 128", 3.5, ACC)}
    {L("M90 120 L86 128", 3.5, ACC)}
    {L("M154 118 L150 126", 3.5, ACC)}
    {L("M160 118 L156 126", 3.5, ACC)}
  </>
);

/** 포즈별 효과 (반짝임, 땀방울, Zzz, 시끄러운 선, 물음표). */
const FX: Partial<Record<Pose, El>> = {
  intune: (
    <g class="fx">
      {L("M34 54 L34 76 M23 65 L45 65", 5)}
      {blob(214, 54, 6, ACC)}
      {L("M210 86 L222 98 M222 86 L210 98", 4.5)}
    </g>
  ),
  flat: (
    <path
      class="fx"
      d="M190 84 Q200 100 190 106 Q180 100 190 84 Z"
      fill={SKY}
      stroke={INK}
      stroke-width={4}
      stroke-linejoin="round"
    />
  ),
  sleep: (
    <g class="fx">
      {L("M186 76 L200 76 L186 90 L200 90", 4.5)}
      {L("M206 52 L216 52 L206 62 L216 62", 4)}
      {L("M222 32 L229 32 L222 39 L229 39", 3.5)}
    </g>
  ),
  clip: (
    <g class="fx">
      {L("M24 74 L40 80", 5, ACC)}
      {L("M22 98 L38 98", 5, ACC)}
      {L("M220 72 L204 78", 5, ACC)}
      {L("M222 96 L206 96", 5, ACC)}
    </g>
  ),
  unsure: (
    <g class="fx">
      {L("M182 42 Q182 26 196 26 Q210 28 206 42 Q200 50 196 58", 5.5)}
      {dot(196, 70, 3.8)}
    </g>
  ),
};

const LABEL: Record<Pose, string> = {
  idle: "기다리는 쓸말이",
  flat: "축 처진 쓸말이",
  sharp: "까치발 든 쓸말이",
  intune: "만세하는 쓸말이",
  sleep: "자는 쓸말이",
  clip: "귀 막은 쓸말이",
  unsure: "갸우뚱하는 쓸말이",
};

export function Mascot({ pose, size = 240 }: { pose: Pose; size?: number }) {
  const p = P[pose];
  const [tail, tx, ty] = TAILS[p.tail];
  const h = HEAD[p.head];
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 240 240"
      width={size}
      height={size}
      class={`cat s-${pose}`}
      role="img"
      aria-label={LABEL[pose]}
    >
      {L("M64 226 Q120 222 178 226", 4, INK, 0.22)}
      <g class="tail">
        {L(tail)}
        {blob(tx, ty, 10, ACC)}
        {dot(tx, ty, 2.5)}
      </g>
      {p.legs === "tip" && (
        <>
          {L("M104 190 L102 226")}
          {L("M138 190 L140 226")}
        </>
      )}
      <g class="body" transform={p.bt}>
        {BODY}
        {LEGS[p.legs]}
      </g>
      <g class="head" transform={p.ht}>
        <path d={h.fill} fill={PAPER} />
        {L(h.line, 7)}
        {WHISK}
        {EYES[p.eyes]}
        {MOUTH[p.mouth]}
        {pose === "intune" && BLUSH}
      </g>
      {ARMS[p.arms]}
      {FX[pose]}
    </svg>
  );
}

/** 로고 / 파비콘용 얼굴. 작게 써도 보이도록 선 9px. */
export function LogoFace({ width = 48 }: { width?: number }) {
  const h = HEAD.up;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="38 26 176 128"
      width={width}
      height={Math.round((width * 128) / 176)}
      class="face"
      aria-hidden="true"
    >
      <path d={h.fill} fill={PAPER} />
      {L(h.line, 9)}
      {L("M70 106 L46 102", 6)}
      {L("M69 119 L48 124", 6)}
      {L("M180 102 L204 96", 6)}
      {L("M182 115 L206 117", 6)}
      {dot(100, 104, 6)}
      {dot(144, 102, 6)}
      {L("M108 114 Q111 128 121 119 Q130 128 135 114", 6.5)}
    </svg>
  );
}
