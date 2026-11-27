import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** 장치 빠짐 → 다시 꽂기 흐름을 가짜 브라우저 API로 확인한다. */

class FakeTrack extends EventTarget {
  readonly kind = "audio";
  constructor(
    readonly deviceId: string,
    readonly label: string,
  ) {
    super();
  }
  getSettings() {
    return { deviceId: this.deviceId, channelCount: 1 };
  }
  stop() {}
  /** 케이블을 뽑으면 브라우저가 ended를 보낸다. */
  unplug() {
    this.dispatchEvent(new Event("ended"));
  }
}

const node = () => ({
  connect: (n: unknown) => n,
  disconnect() {},
  frequency: { value: 0 },
  Q: { value: 0 },
  gain: { value: 0 },
  getFloatTimeDomainData() {},
});

class FakeAudioContext {
  state = "running";
  sampleRate = 48000;
  async resume() {}
  createMediaStreamSource = node;
  createGain = node;
  createAnalyser = node;
  createBiquadFilter = node;
}

const IFACE = { deviceId: "iface", label: "오인페" };
const MIC = { deviceId: "mic", label: "노트북 마이크" };

let plugged: { deviceId: string; label: string }[];
let tracks: FakeTrack[];
const getUserMedia = vi.fn(async ({ audio }: { audio: MediaTrackConstraints }) => {
  const want = (audio.deviceId as { exact?: string } | undefined)?.exact;
  const dev = want ? plugged.find((d) => d.deviceId === want) : plugged[plugged.length - 1];
  if (!dev) throw Object.assign(new Error("gone"), { name: "OverconstrainedError" });
  const t = new FakeTrack(dev.deviceId, dev.label);
  tracks.push(t);
  return { getAudioTracks: () => [t], getTracks: () => [t] };
});

async function load() {
  vi.resetModules();
  return import("./useAudioInput.ts");
}

beforeEach(() => {
  plugged = [MIC, IFACE];
  tracks = [];
  getUserMedia.mockClear();
  const store = new Map<string, string>();
  vi.stubGlobal("window", { AudioContext: FakeAudioContext, isSecureContext: true });
  vi.stubGlobal("location", { search: "" });
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
    removeItem: (k: string) => store.delete(k),
  });
  vi.stubGlobal("navigator", {
    mediaDevices: {
      getUserMedia,
      enumerateDevices: async () => plugged.map((d) => ({ ...d, kind: "audioinput" })),
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("장치 빠짐", () => {
  it("빠지면 열린 장치가 없어지고, 장치 고르기에서 같은 장치를 다시 고를 수 있다", async () => {
    const a = await load();
    await a.chooseDevice(IFACE.deviceId);
    a.goTuner();
    expect(a.screen.value).toBe("tuner");

    plugged = [MIC];
    tracks[tracks.length - 1].unplug();
    expect(a.screen.value).toBe("unplugged");
    expect(a.currentId.value).toBeNull();
    expect(a.currentLabel.value).toBe(IFACE.label); // 빠짐 화면 문구에 쓴다
    expect(a.engine.attached).toBe(false);

    await a.goDevices();
    plugged = [MIC, IFACE];
    await a.chooseDevice(IFACE.deviceId); // 예전엔 "이미 열린 장치"라 무시됐다
    expect(a.currentId.value).toBe(IFACE.deviceId);
    expect(a.engine.attached).toBe(true);
    a.goTuner();
    expect(a.screen.value).toBe("tuner");
  });

  it("다시 꽂았어: 아직 안 꽂혔으면 기본 입력(마이크)으로 열지 않는다", async () => {
    const a = await load();
    await a.chooseDevice(IFACE.deviceId);
    a.goTuner();
    plugged = [MIC];
    tracks[tracks.length - 1].unplug();
    getUserMedia.mockClear();

    await a.replug();
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(a.screen.value).toBe("unplugged");
    expect(a.notice.value).toMatch("아직 안 보여");

    plugged = [MIC, IFACE];
    await a.replug();
    expect(a.screen.value).toBe("tuner");
    expect(a.currentId.value).toBe(IFACE.deviceId);
  });
});
