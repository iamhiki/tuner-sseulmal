import { describe, expect, it } from "vitest";
import { AudioInputError, classifyError, settingsTags } from "./deviceManager.ts";

const err = (name: string) => Object.assign(new Error(name), { name });

describe("classifyError", () => {
  it("권한 거부", () => {
    expect(classifyError(err("NotAllowedError"))).toBe("denied");
    expect(classifyError(err("SecurityError"))).toBe("denied");
  });
  it("장치 없음", () => {
    expect(classifyError(err("NotFoundError"))).toBe("notFound");
    expect(classifyError(err("OverconstrainedError"))).toBe("notFound");
  });
  it("다른 앱이 쓰는 중", () => {
    expect(classifyError(err("NotReadableError"))).toBe("busy");
  });
  it("우리가 만든 오류는 그대로", () => {
    expect(classifyError(new AudioInputError("unsupported"))).toBe("unsupported");
  });
  it("모르는 오류", () => {
    expect(classifyError("뭔가")).toBe("unknown");
    expect(classifyError(null)).toBe("unknown");
  });
});

describe("settingsTags", () => {
  it("시안과 같은 문구로 적용값을 보여준다", () => {
    expect(
      settingsTags({
        sampleRate: 48000,
        channelCount: 1,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      }),
    ).toEqual(["48,000 Hz", "1채널", "에코 제거 끔", "잡음 억제 끔", "자동 게인 끔"]);
  });
  it("켜져 있으면 경고, 모르면 뺀다", () => {
    expect(settingsTags({ sampleRate: 44100, autoGainControl: true })).toEqual([
      "44,100 Hz",
      "자동 게인 켜짐 ⚠️",
    ]);
  });
});
