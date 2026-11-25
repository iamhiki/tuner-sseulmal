import type { InputDevice } from "../audio/deviceManager.ts";
import { MiniMeter } from "./InputLevelMeter.tsx";
import { Solo } from "./Solo.tsx";

/** F-02/F-03 장치 고르기. 고르면 바로 열어서 옆 막대로 소리가 들어오는지 보여준다. */
export function DeviceSelector({
  devices,
  currentId,
  currentSub,
  bar,
  busy,
  notice,
  onChoose,
  onConfirm,
}: {
  devices: InputDevice[];
  currentId: string | null;
  /** 지금 열린 장치 밑에 붙는 설명 (예: 48 kHz · 1채널). */
  currentSub: string;
  bar: number;
  busy: boolean;
  notice: string | null;
  onChoose: (deviceId: string) => void;
  onConfirm: () => void;
}) {
  const noLabels = devices.length > 0 && devices.every((d) => !d.label);
  return (
    <Solo pose="unsure" title="어디에 꽂았어?">
      <p>줄을 하나 튕겨봐. 소리가 들어오는 장치 옆 막대가 움직여.</p>
      {devices.length === 0 ? (
        <p class="notice">입력 장치가 하나도 안 보여. 오인페를 꽂고 잠깐 기다려줘.</p>
      ) : (
        <ul class="devs">
          {devices.map((d, i) => {
            const on = d.deviceId === currentId;
            return (
              <li key={d.deviceId || i}>
                <label>
                  <input
                    type="radio"
                    name="device"
                    value={d.deviceId}
                    checked={on}
                    disabled={busy && !on}
                    onChange={() => onChoose(d.deviceId)}
                  />
                  <span class="nm">
                    {d.label || `이름 없는 입력 ${i + 1}`}
                    {on && currentSub && <span class="sub">{currentSub}</span>}
                  </span>
                  <MiniMeter bar={bar} active={on} />
                </label>
              </li>
            );
          })}
        </ul>
      )}
      {notice && (
        <p class="notice" role="status">
          {notice}
        </p>
      )}
      <div class="btns">
        <button type="button" class="btn" onClick={onConfirm} disabled={!currentId || busy}>
          이걸로 할래
        </button>
      </div>
      <p class="tiny">
        {noLabels
          ? "이름이 비어 보이면 권한을 아직 안 준 거야. 시작부터 다시 눌러줘."
          : "막대는 지금 고른 장치만 움직여."}
      </p>
    </Solo>
  );
}
