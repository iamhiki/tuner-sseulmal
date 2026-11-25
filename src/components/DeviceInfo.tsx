import { type AppliedSettings, settingsTags } from "../audio/deviceManager.ts";

/** 지금 듣는 장치 + 브라우저가 실제로 적용한 값 (기획 5장: getSettings로 표시). */
export function DeviceInfo({
  label,
  settings,
  onChange,
}: {
  label: string;
  settings: AppliedSettings | null;
  onChange: () => void;
}) {
  return (
    <div class="dinfo">
      <div class="cap">지금 듣는 장치</div>
      <div class="nm">{label || "이름 없는 입력"}</div>
      {settings && (
        <div class="tags">
          {settingsTags(settings).map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
      )}
      <button type="button" class="link" onClick={onChange}>
        장치 바꾸기
      </button>
    </div>
  );
}
