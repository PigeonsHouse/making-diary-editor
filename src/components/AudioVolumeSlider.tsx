"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  value: number | null;
  defaultValue: number;
  onChange: (value: number | null) => void;
  allowDefault?: boolean;
  label?: string;
  defaultLabel?: string;
};

export function AudioVolumeSlider({
  value,
  defaultValue,
  onChange,
  allowDefault = true,
  label = "音量",
  defaultLabel = "素材既定",
}: Props) {
  const overridden = value !== null;
  const effectiveValue = value ?? defaultValue;
  const [maximum, setMaximum] = useState(() => initialMaximum(effectiveValue));
  const interactionValue = useRef(effectiveValue);

  useEffect(() => {
    interactionValue.current = effectiveValue;
    if (effectiveValue > maximum) setMaximum(initialMaximum(effectiveValue));
  }, [effectiveValue, maximum]);

  const settleMaximum = () => {
    const next = interactionValue.current;
    if (next >= maximum) {
      setMaximum(maximum * 2);
      return;
    }
    let reduced = maximum;
    while (reduced > 2 && next <= reduced / 2) reduced /= 2;
    setMaximum(Math.max(2, reduced));
  };

  return (
    <div className={`voice-slider audio-volume-slider ${allowDefault && !overridden ? "disabled" : ""}`}>
      <div className="voice-slider-heading">
        <strong>{label}</strong>
        <output>{Math.round(effectiveValue * 100)}%</output>
        <small>
          {allowDefault && !overridden
            ? `${defaultLabel} ${Math.round(defaultValue * 100)}%`
            : `×${Math.round(maximum / 2)}`}
        </small>
        {allowDefault ? (
          <button
            type="button"
            className="voice-override-toggle"
            onClick={() => onChange(overridden ? null : defaultValue)}
          >
            {overridden ? "既定に戻す" : "上書き"}
          </button>
        ) : null}
      </div>
      <input
        type="range"
        min="0"
        max={maximum}
        step="0.05"
        value={effectiveValue}
        disabled={allowDefault && !overridden}
        onChange={(event) => {
          const next = Number(event.target.value);
          interactionValue.current = next;
          onChange(next);
        }}
        onPointerDown={() => {
          interactionValue.current = effectiveValue;
        }}
        onPointerUp={settleMaximum}
        onKeyUp={settleMaximum}
      />
    </div>
  );
}

function initialMaximum(value: number) {
  let maximum = 2;
  while (value > maximum) maximum *= 2;
  return maximum;
}
