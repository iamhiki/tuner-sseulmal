import { Solo } from "./Solo.tsx";

/** F-08 오류 화면: 권한 거부 · 장치 빠짐 · 미지원. 문구는 승인된 시안 그대로. */

export function DeniedScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <Solo pose="flat" title="권한이 막혀 있어…">
      <p>이러면 아무것도 못 들어. 이렇게 풀어줘:</p>
      <ol class="steps">
        <li>
          주소창 왼쪽 <kbd>자물쇠</kbd> 누르기
        </li>
        <li>
          <kbd>마이크</kbd>를 <kbd>허용</kbd>으로 바꾸기
        </li>
        <li>새로고침</li>
      </ol>
      <div class="btns">
        <button type="button" class="btn" onClick={onRetry}>
          다시 해볼래
        </button>
      </div>
    </Solo>
  );
}

export function UnpluggedScreen({
  deviceLabel,
  notice,
  busy,
  onReplug,
  onChoose,
}: {
  deviceLabel: string;
  notice: string | null;
  busy: boolean;
  onReplug: () => void;
  onChoose: () => void;
}) {
  return (
    <Solo pose="clip" title="어? 오인페가 빠졌어">
      <p>
        {deviceLabel || "입력 장치"} 연결이 끊겼어.
        <br />
        케이블 다시 꽂으면 알아서 이어볼게. 아니면 다른 장치를 골라줘.
      </p>
      <div class="btns">
        <button type="button" class="btn" onClick={onReplug} disabled={busy}>
          다시 꽂았어
        </button>
        <button type="button" class="btn ghost" onClick={onChoose}>
          장치 고르기
        </button>
      </div>
      {notice && (
        <p class="notice" role="status">
          {notice}
        </p>
      )}
    </Solo>
  );
}

export function UnsupportedScreen({ onHome }: { onHome: () => void }) {
  return (
    <Solo pose="sleep" title="이 브라우저는 못 들어…">
      <p>
        오디오 입력을 못 받는 브라우저거나, 주소가 https가 아니야.
        <br />
        Chrome, Edge, Safari, Firefox 최신 버전에서 https 주소로 열어줘.
      </p>
      <div class="btns">
        <button type="button" class="btn ghost" onClick={onHome}>
          처음으로
        </button>
      </div>
    </Solo>
  );
}
