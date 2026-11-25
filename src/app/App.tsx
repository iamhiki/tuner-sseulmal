import { useEffect, useRef } from "preact/hooks";
import { DeviceInfo } from "../components/DeviceInfo.tsx";
import { DeviceSelector } from "../components/DeviceSelector.tsx";
import { Header } from "../components/Header.tsx";
import { InputLevelMeter } from "../components/InputLevelMeter.tsx";
import { StartScreen } from "../components/StartScreen.tsx";
import { DeniedScreen, UnpluggedScreen, UnsupportedScreen } from "../components/StatusMessage.tsx";
import { TunerDisplay } from "../components/TunerDisplay.tsx";
import { TuningPreset } from "../components/TuningPreset.tsx";
import {
  busy,
  chooseDevice,
  currentId,
  currentLabel,
  devices,
  goDevices,
  goTuner,
  notice,
  replug,
  restart,
  screen,
  settings,
  start,
  watchDeviceChanges,
} from "../hooks/useAudioInput.ts";
import {
  level,
  lockedString,
  pitch,
  quietMs,
  toggleString,
  tunedStrings,
  usePitchLoop,
} from "../hooks/usePitch.ts";
import { bassTuning } from "../lib/bass.ts";
import { tunerView } from "./tunerView.ts";

function Tuner() {
  const p = pitch.value;
  const lv = level.value;
  const view = tunerView(lv.state, p, quietMs.value);
  // 확정값이 없을 때도 목표 줄은 직전 값(처음엔 E1)을 보여준다.
  const lastString = useRef(0);
  if (p.stringIndex >= 0) lastString.current = p.stringIndex;
  const targetIndex = lockedString.value ?? lastString.current;
  return (
    <section class="box tuner" aria-label="튜너">
      <TunerDisplay pitch={p} view={view} target={bassTuning.strings[targetIndex]} />
      <TuningPreset
        strings={bassTuning.strings}
        current={p.stringIndex}
        locked={lockedString.value}
        tuned={tunedStrings.value}
        onToggle={toggleString}
      />
      <div class="foot">
        <InputLevelMeter level={lv} />
        <DeviceInfo label={currentLabel.value} settings={settings.value} onChange={goDevices} />
      </div>
    </section>
  );
}

function deviceSub(): string {
  const s = settings.value;
  if (!s) return "";
  const khz = `${(s.sampleRate / 1000).toLocaleString("en-US", { maximumFractionDigits: 1 })} kHz`;
  return s.channelCount ? `${khz} · ${s.channelCount}채널` : khz;
}

export function App() {
  usePitchLoop();
  useEffect(() => watchDeviceChanges(), []);
  const sc = screen.value;

  let body = null;
  switch (sc) {
    case "start":
      body = <StartScreen busy={busy.value} onStart={start} />;
      break;
    case "devices":
      body = (
        <DeviceSelector
          devices={devices.value}
          currentId={currentId.value}
          currentSub={deviceSub()}
          bar={level.value.bar}
          busy={busy.value}
          notice={notice.value}
          onChoose={chooseDevice}
          onConfirm={goTuner}
        />
      );
      break;
    case "tuner":
      body = <Tuner />;
      break;
    case "denied":
      body = <DeniedScreen onRetry={start} />;
      break;
    case "unplugged":
      body = (
        <UnpluggedScreen
          deviceLabel={currentLabel.value}
          notice={notice.value}
          busy={busy.value}
          onReplug={replug}
          onChoose={goDevices}
        />
      );
      break;
    case "unsupported":
      body = <UnsupportedScreen onHome={restart} />;
      break;
  }

  const pill =
    sc === "devices"
      ? "장치 고르는 중"
      : sc === "tuner" || sc === "unplugged"
        ? currentLabel.value || "이름 없는 입력"
        : null;
  return (
    <>
      {/* 낙서처럼 살짝 삐뚤게 (쓸말이 선에만 쓴다) */}
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
        <filter id="wob">
          <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves={2} seed={3} />
          <feDisplacementMap in="SourceGraphic" scale={3.2} />
        </filter>
      </svg>
      <Header deviceLabel={pill} onDeviceClick={sc === "tuner" ? goDevices : undefined} />
      <main class="band main">{body}</main>
    </>
  );
}
