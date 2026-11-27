import { Solo } from "./Solo.tsx";

/** F-08 오류 화면: 권한 거부 · 장치 빠짐 · 미지원. 문구는 승인된 시안 그대로. */

export function DeniedScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <Solo pose="flat" title="권한이 막혀 있어요…">
      <p>이러면 아무것도 못 들어요. 이렇게 풀어주세요:</p>
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
          다시 해볼래요
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
    <Solo pose="clip" title="어? 오인페가 빠졌다냥">
      <p>
        {deviceLabel || "입력 장치"} 연결이 끊겼어요.
        <br />
        케이블 다시 꽂으면 <span class="nb">알아서 이어볼게요.</span>
        <br />
        아니면 다른 장치를 <span class="nb">골라주세요.</span>
      </p>
      <div class="btns">
        <button type="button" class="btn" onClick={onReplug} disabled={busy}>
          다시 꽂았어요
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
    <Solo pose="sleep" title="이 브라우저로는 못 듣겠다냥…">
      <p>
        오디오 입력을 못 받는 브라우저거나, 주소가 https가 아니에요.
        <br />
        <span class="nb">Chrome, Edge, Safari, Firefox</span> 최신 버전에서
        <br />
        https 주소로 열어주세요.
      </p>
      <div class="btns">
        <button type="button" class="btn ghost" onClick={onHome}>
          처음으로
        </button>
      </div>
    </Solo>
  );
}
