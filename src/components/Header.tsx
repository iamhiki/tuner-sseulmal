import { LogoFace } from "./Mascot.tsx";

/** 상단 바: 로고 + 지금 장치 알약 (누르면 장치 고르기). */
export function Header({
  deviceLabel,
  onDeviceClick,
}: {
  /** null이면 장치 알약을 숨긴다. */
  deviceLabel: string | null;
  onDeviceClick?: () => void;
}) {
  return (
    <header class="top band">
      <div class="logo">
        <LogoFace width={48} />
        <span class="logo-name">튜너쓸말</span>
        <small>튜너 쓸래말래</small>
      </div>
      {deviceLabel !== null && (
        <button
          type="button"
          class="device-pill"
          onClick={onDeviceClick}
          disabled={!onDeviceClick}
          aria-label={`입력 장치: ${deviceLabel}. 바꾸기`}
        >
          <span class="num">{deviceLabel}</span>
          <span class="chev" aria-hidden="true">
            ▼
          </span>
        </button>
      )}
    </header>
  );
}
