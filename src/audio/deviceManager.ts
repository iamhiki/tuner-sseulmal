/**
 * F-01~F-03 입력 권한 · 장치 열거 · 장치 선택.
 * 장치 테스트 페이지(PR #5)의 흐름을 앱 코드로 옮겼다.
 */

const STORAGE_KEY = "tuner-sseulmal.deviceId";

export interface InputDevice {
  deviceId: string;
  /** 권한 전에는 빈 문자열일 수 있다. */
  label: string;
}

/** 튜너에는 브라우저의 음성 처리가 모두 꺼져 있어야 한다. */
const RAW_AUDIO: MediaTrackConstraints = {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
};

export type AudioErrorKind = "denied" | "notFound" | "busy" | "unsupported" | "unknown";

export class AudioInputError extends Error {
  constructor(
    readonly kind: AudioErrorKind,
    readonly cause?: unknown,
  ) {
    super(kind);
  }
}

/** getUserMedia 등에서 나온 오류를 화면에 보여줄 종류로 나눈다. */
export function classifyError(e: unknown): AudioErrorKind {
  if (e instanceof AudioInputError) return e.kind;
  const name = (e as { name?: string } | null)?.name ?? "";
  switch (name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
    case "SecurityError":
      return "denied";
    case "NotFoundError":
    case "DevicesNotFoundError":
    case "OverconstrainedError":
      return "notFound";
    case "NotReadableError":
    case "TrackStartError":
    case "AbortError":
      return "busy";
    case "TypeError":
    case "NotSupportedError":
      return "unsupported";
    default:
      return "unknown";
  }
}

type AudioContextCtor = typeof AudioContext;

export function audioContextCtor(): AudioContextCtor | undefined {
  if (typeof window === "undefined") return undefined;
  return (
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext
  );
}

/** https(또는 localhost) + getUserMedia + Web Audio가 모두 있어야 쓸 수 있다. */
export function isSupported(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  return (
    window.isSecureContext !== false &&
    typeof navigator.mediaDevices?.getUserMedia === "function" &&
    !!audioContextCtor()
  );
}

export async function listInputs(): Promise<InputDevice[]> {
  const all = await navigator.mediaDevices.enumerateDevices();
  return all
    .filter((d) => d.kind === "audioinput")
    .map((d) => ({ deviceId: d.deviceId, label: d.label }));
}

export interface OpenedInput {
  stream: MediaStream;
  track: MediaStreamTrack;
  /** 실제로 열린 장치. 기본 장치로 대체됐으면 요청한 것과 다를 수 있다. */
  deviceId: string;
  /** 고른 장치가 사라져 기본 장치로 대신 열었는지. */
  fellBack: boolean;
}

/**
 * 입력 장치를 연다. deviceId가 없으면 기본 장치.
 * 저장해 둔 장치가 사라졌으면(OverconstrainedError) 기본 장치로 대신 연다.
 */
export async function openInput(deviceId?: string): Promise<OpenedInput> {
  const audio: MediaTrackConstraints = { ...RAW_AUDIO, channelCount: { ideal: 2 } };
  if (deviceId) audio.deviceId = { exact: deviceId };
  let stream: MediaStream;
  let fellBack = false;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio });
  } catch (e) {
    const name = (e as { name?: string }).name;
    if (!deviceId || (name !== "OverconstrainedError" && name !== "NotFoundError")) throw e;
    forgetDevice();
    stream = await navigator.mediaDevices.getUserMedia({ audio: { ...RAW_AUDIO } });
    fellBack = true;
  }
  const track = stream.getAudioTracks()[0];
  if (!track) {
    for (const t of stream.getTracks()) t.stop();
    throw new AudioInputError("notFound");
  }
  const used = track.getSettings?.().deviceId || deviceId || "";
  if (used) rememberDevice(used);
  return { stream, track, deviceId: used, fellBack };
}

export function stopStream(stream: MediaStream | null | undefined): void {
  if (stream) for (const t of stream.getTracks()) t.stop();
}

export function savedDeviceId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function rememberDevice(id: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // 시크릿 모드 등에서 저장이 막혀도 튜너는 동작해야 한다.
  }
}

function forgetDevice(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 위와 같음
  }
}

export interface AppliedSettings {
  sampleRate: number;
  channelCount?: number;
  echoCancellation?: boolean;
  noiseSuppression?: boolean;
  autoGainControl?: boolean;
}

/** 화면 "지금 듣는 장치"에 붙는 태그. 실제 적용값(getSettings) 기준. */
export function settingsTags(s: AppliedSettings): string[] {
  const onOff = (v: boolean | undefined, label: string) =>
    v === undefined ? null : v ? `${label} 켜짐 ⚠️` : `${label} 끔`;
  return [
    `${s.sampleRate.toLocaleString("en-US")} Hz`,
    s.channelCount ? `${s.channelCount}채널` : null,
    onOff(s.echoCancellation, "에코 제거"),
    onOff(s.noiseSuppression, "잡음 억제"),
    onOff(s.autoGainControl, "자동 게인"),
  ].filter((t): t is string => t !== null);
}
