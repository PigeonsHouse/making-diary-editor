"use client";

import {useEffect, useRef, useState} from "react";
import type {VoiceSettings} from "@/domain/types";

type AdjustableKey = "speed" | "pitch" | "intonation" | "volume";
type AdjustableValues = Pick<VoiceSettings, AdjustableKey>;

const configs: Record<AdjustableKey, {label: string; min: number; baseMax: number; step: number; symmetric?: boolean}> =
  {
    speed: {label: "話速", min: 0.1, baseMax: 2, step: 0.05},
    pitch: {label: "ピッチ", min: -0.15, baseMax: 0.15, step: 0.01, symmetric: true},
    intonation: {label: "抑揚", min: 0, baseMax: 2, step: 0.05},
    volume: {label: "音量", min: 0, baseMax: 2, step: 0.05},
  };

export function VoiceSettingsSliders({
  values,
  defaults,
  onChange,
  allowUnset = false,
}: {
  values: Partial<AdjustableValues>;
  defaults: AdjustableValues;
  onChange: (key: AdjustableKey, value: number | undefined) => void;
  allowUnset?: boolean;
}) {
  return (
    <div className="voice-sliders">
      {(Object.keys(configs) as AdjustableKey[]).map((key) => {
        const overridden = values[key] !== undefined;
        return (
          <AdaptiveSlider
            key={key}
            config={configs[key]}
            value={values[key] ?? defaults[key]}
            disabled={allowUnset && !overridden}
            multiplierEnabled={overridden || !allowUnset}
            onChange={(value) => onChange(key, value)}
            action={
              allowUnset ? (
                <button
                  type="button"
                  className="voice-override-toggle"
                  onClick={() => onChange(key, overridden ? undefined : defaults[key])}
                >
                  {overridden ? "既定に戻す" : "上書き"}
                </button>
              ) : null
            }
          />
        );
      })}
    </div>
  );
}

function AdaptiveSlider({
  config,
  value,
  disabled,
  multiplierEnabled,
  onChange,
  action,
}: {
  config: {label: string; min: number; baseMax: number; step: number; symmetric?: boolean};
  value: number;
  disabled: boolean;
  multiplierEnabled: boolean;
  onChange: (value: number) => void;
  action: React.ReactNode;
}) {
  const [maximum, setMaximum] = useState(() => initialMaximum(value, config.baseMax, config.symmetric));
  const interactionValue = useRef(value);
  useEffect(() => {
    interactionValue.current = value;
    if (Math.abs(value) > maximum) setMaximum(initialMaximum(value, config.baseMax, config.symmetric));
  }, [value, maximum, config.baseMax, config.symmetric]);

  const settleMaximum = () => {
    const next = interactionValue.current;
    if (next >= maximum || (config.symmetric && next <= -maximum)) {
      setMaximum(maximum * 2);
    } else {
      let reduced = maximum;
      const comparedValue = config.symmetric ? Math.abs(next) : next;
      while (reduced > config.baseMax && comparedValue <= reduced / 2) reduced /= 2;
      setMaximum(Math.max(config.baseMax, reduced));
    }
  };
  const multiplier = Math.round(maximum / config.baseMax);
  return (
    <div className={`voice-slider ${disabled ? "disabled" : ""}`}>
      <div className="voice-slider-heading">
        <strong>{config.label}</strong>
        <output>{value.toFixed(config.step < 0.05 ? 2 : 2)}</output>
        {multiplierEnabled ? <small>×{multiplier}</small> : <small>キャラクター既定</small>}
        {action}
      </div>
      <input
        type="range"
        min={config.symmetric ? -maximum : config.min}
        max={maximum}
        step={config.step}
        value={value}
        disabled={disabled}
        onChange={(event) => {
          const next = Number(event.target.value);
          interactionValue.current = next;
          onChange(next);
        }}
        onPointerDown={() => {
          interactionValue.current = value;
        }}
        onPointerUp={settleMaximum}
        onKeyUp={settleMaximum}
      />
    </div>
  );
}

function initialMaximum(value: number, baseMax: number, symmetric = false) {
  let maximum = baseMax;
  const comparedValue = symmetric ? Math.abs(value) : value;
  while (comparedValue > maximum) maximum *= 2;
  return maximum;
}
