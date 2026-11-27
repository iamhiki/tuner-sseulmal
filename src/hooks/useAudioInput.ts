import { batch, signal } from "@preact/signals";
import { AudioEngine } from "../audio/audioEngine.ts";
import {
  type AppliedSettings,
  type AudioErrorKind,
  classifyError,
  type InputDevice,
  isSupported,
  listInputs,
  openInput,
  savedDeviceId,
  stopStream,
} from "../audio/deviceManager.ts";

/**
 * 화면 흐름과 입력 장치 상태 (기획 3장).
 * start → (권한) → devices → tuner. 오류: denied / unplugged / unsupported.
 */
export type Screen = "start" | "devices" | "tuner" | "denied" | "unplugged" | "unsupported";

/** 주소에 ?tone을 붙이면 장치 목록에 합성음 입력이 생긴다 (베이스 없이 화면 확인용). */
export const TEST_TONE_ID = "__test-tone__";
const toneEnabled = () =>
  typeof location !== "undefined" && new URLSearchParams(location.search).has("tone");
const TEST_TONE: InputDevice = { deviceId: TEST_TONE_ID, label: "테스트 톤 (합성음)" };

export const engine = new AudioEngine();

export const screen = signal<Screen>(isSupported() || toneEnabled() ? "start" : "unsupported");
export const devices = signal<InputDevice[]>([]);
/** 지금 열려 있는 장치. */
export const currentId = signal<string | null>(null);
export const currentLabel = signal("");
export const settings = signal<AppliedSettings | null>(null);
/** 화면 안에 한 줄로 보여줄 오류 (권한 거부·장치 빠짐은 전용 화면). */
export const notice = signal<string | null>(null);
export const busy = signal(false);

let stream: MediaStream | null = null;
let openSeq = 0;
/** 장치가 빠졌을 때 다시 꽂히면 이어 붙일 장치. */
let lostId: string | null = null;

const NOTICE: Partial<Record<AudioErrorKind, string>> = {
  notFound: "입력 장치를 못 찾았어요. 오인페가 꽂혀 있는지 봐주세요.",
  busy: "다른 앱이 이 장치를 쓰고 있나 봐요. DAW나 통화 앱을 끄고 다시 골라주세요.",
  unknown: "장치를 못 열었어요. 다른 장치를 골라보거나 새로고침해주세요.",
};

const NOT_BACK = "아직 안 보여요. 케이블을 다시 꽂고 잠깐만 기다려주세요.";

function fail(e: unknown): void {
  const kind = classifyError(e);
  if (kind === "denied") screen.value = "denied";
  else if (kind === "unsupported") screen.value = "unsupported";
  else notice.value = NOTICE[kind] ?? NOTICE.unknown!;
}

export async function refreshDevices(): Promise<void> {
  let list: InputDevice[] = [];
  try {
    if (typeof navigator.mediaDevices?.enumerateDevices === "function") list = await listInputs();
  } catch {
    // 목록을 못 받아도 테스트 톤은 보여준다.
  }
  devices.value = toneEnabled() ? [...list, TEST_TONE] : list;
}

function trackSettings(track: MediaStreamTrack, sampleRate: number): AppliedSettings {
  const s = track.getSettings?.() ?? {};
  return {
    sampleRate,
    channelCount: s.channelCount,
    echoCancellation: s.echoCancellation,
    noiseSuppression: s.noiseSuppression,
    autoGainControl: s.autoGainControl,
  };
}

/** 장치를 연다. 새 장치를 먼저 열고 성공하면 바꾼다 (실패하면 기존 입력 유지). */
export async function openDevice(deviceId?: string): Promise<boolean> {
  const my = ++openSeq;
  busy.value = true;
  notice.value = null;
  try {
    await engine.ensureContext(); // 클릭 안에서 AudioContext를 깨운다
    if (my !== openSeq) return false; // 기다리는 동안 더 최신 요청이 왔다
    if (deviceId === TEST_TONE_ID) {
      stopStream(stream);
      stream = null;
      await engine.attachTestTone();
      batch(() => {
        currentId.value = TEST_TONE_ID;
        currentLabel.value = TEST_TONE.label;
        settings.value = { sampleRate: engine.sampleRate, channelCount: 1 };
      });
      return true;
    }
    const opened = await openInput(deviceId);
    if (my !== openSeq) {
      stopStream(opened.stream); // 더 최신 요청이 있었다
      return false;
    }
    stopStream(stream);
    stream = opened.stream;
    await engine.attachStream(opened.stream);
    const { track } = opened;
    track.addEventListener("ended", () => {
      if (stream?.getAudioTracks()[0] !== track) return; // 이미 다른 장치로 바뀜
      lostId = opened.deviceId;
      engine.detach();
      stopStream(stream);
      stream = null;
      // 열린 장치가 없다고 표시한다. 그래야 장치 고르기에서 같은 장치를 다시 누를 수 있고
      // ("이미 열린 장치"로 보고 무시하지 않게), "이걸로 할래"도 막힌다. 이름은 빠짐 화면에 쓴다.
      batch(() => {
        currentId.value = null;
        settings.value = null;
        screen.value = "unplugged";
      });
    });
    await refreshDevices();
    if (my !== openSeq) return false; // 그사이 다른 장치가 열렸다 (이름을 덮어쓰지 않게)
    const label =
      track.label || devices.value.find((d) => d.deviceId === opened.deviceId)?.label || "";
    batch(() => {
      currentId.value = opened.deviceId;
      currentLabel.value = label;
      settings.value = trackSettings(track, engine.sampleRate);
      if (opened.fellBack) notice.value = "고른 장치가 없어서 기본 입력으로 열었어요.";
    });
    return true;
  } catch (e) {
    if (my === openSeq) fail(e);
    return false;
  } finally {
    if (my === openSeq) busy.value = false;
  }
}

/** 시작 버튼: 권한을 받고(저장된 장치가 있으면 그걸로) 장치 고르기로 간다. */
export async function start(): Promise<void> {
  if (isSupported()) {
    await openDevice(savedDeviceId() ?? undefined);
    // 권한 거부·미지원이면 전용 화면으로 이미 넘어갔다. 그 밖의 오류는 장치 고르기에서 안내한다.
    if (screen.value !== "start") return;
  } else if (!toneEnabled()) {
    screen.value = "unsupported";
    return;
  }
  await refreshDevices();
  screen.value = "devices";
}

export async function chooseDevice(deviceId: string): Promise<void> {
  if (deviceId === currentId.value) return;
  await openDevice(deviceId);
}

export function goTuner(): void {
  if (engine.attached) screen.value = "tuner";
}

export async function goDevices(): Promise<void> {
  screen.value = "devices";
  await refreshDevices();
}

/** "다시 꽂았어": 빠진 장치를 다시 열어 본다. */
export async function replug(): Promise<void> {
  // 빠진 장치가 아직 목록에 없으면 열지 않는다. 열면 기본 입력(노트북 마이크)으로 대신 열려
  // 오인페 대신 마이크 소리를 듣게 된다. 이름·ID가 빈 항목이 있으면(권한 전) 판단할 수 없으니 열어 본다.
  if (lostId) {
    await refreshDevices();
    if (!devices.value.some((d) => d.deviceId === lostId || d.deviceId === "")) {
      notice.value = NOT_BACK;
      return;
    }
  }
  const ok = await openDevice(lostId ?? undefined);
  if (ok) {
    lostId = null;
    screen.value = "tuner";
  } else if (screen.value === "unplugged") {
    notice.value = NOT_BACK;
  }
}

export function restart(): void {
  notice.value = null;
  screen.value = isSupported() ? "start" : "unsupported";
}

/** 장치가 꽂히고 빠질 때: 목록을 새로 받고, 빠졌던 장치가 돌아오면 알아서 이어 붙인다. */
export function watchDeviceChanges(): () => void {
  const md = typeof navigator !== "undefined" ? navigator.mediaDevices : undefined;
  if (!md?.addEventListener) return () => {};
  const onChange = async () => {
    await refreshDevices();
    if (screen.value === "unplugged" && lostId && devices.value.some((d) => d.deviceId === lostId))
      await replug();
  };
  md.addEventListener("devicechange", onChange);
  return () => md.removeEventListener("devicechange", onChange);
}
