import { useState } from "preact/hooks";
import { Solo } from "./Solo.tsx";

/** F-01 시작 (권한 요청 전). */
export function StartScreen({ busy, onStart }: { busy: boolean; onStart: () => void }) {
  const [declined, setDeclined] = useState(false);
  return (
    <Solo pose={declined ? "sleep" : "idle"} title="튜너 쓸래말래">
      <p>
        오인페에 베이스 꽂았으면 시작 눌러줘.
        <br />
        브라우저가 입력 권한을 물어볼 거야. 소리는 이 브라우저 밖으로 절대 안 나가.
      </p>
      <div class="btns">
        <button type="button" class="btn" onClick={onStart} disabled={busy}>
          쓸래! 시작
        </button>
        <button type="button" class="btn ghost" onClick={() => setDeclined(true)}>
          말래…
        </button>
      </div>
      {declined && (
        <p class="notice" role="status">
          알겠어, 쿨쿨… 마음 바뀌면 시작 눌러줘.
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
