import { isHighPitchMora } from "@/domain/voicevox-user-dict";

type Props = {
  moras: string[];
  accentType: number;
  onChange: (accentType: number) => void;
};

const MORA_WIDTH = 72;
const HIGH_Y = 15;
const LOW_Y = 45;

export function MoraAccentEditor({ moras, accentType, onChange }: Props) {
  const graphWidth = (moras.length + 1) * MORA_WIDTH;
  const points = Array.from({ length: moras.length + 1 }, (_, index) => {
    const x = index * MORA_WIDTH + MORA_WIDTH / 2;
    const y = isHighPitchMora(index, accentType) ? HIGH_Y : LOW_Y;
    return { x, y };
  });
  const selectedMora = accentType > 0 ? moras[accentType - 1] : null;

  return (
    <fieldset className="accent-editor">
      <legend>アクセント位置</legend>
      <div className="accent-editor-heading">
        <div>
          <strong>{moras.length}モーラ</strong>
          <span>{accentType === 0 ? "0型（平板）" : `${accentType}型（「${selectedMora}」の後で下がる）`}</span>
        </div>
        <button
          type="button"
          className={`accent-flat-button ${accentType === 0 ? "selected" : ""}`}
          aria-pressed={accentType === 0}
          onClick={() => onChange(0)}
        >
          <span>平板</span>
          <small>下がらない</small>
        </button>
      </div>

      <div className="mora-accent-scroll">
        <div className="mora-accent-canvas" style={{ width: graphWidth }}>
          <svg
            className="mora-pitch-graph"
            width={graphWidth}
            height="78"
            viewBox={`0 0 ${graphWidth} 78`}
            role="img"
            aria-label={accentType === 0 ? "平板型のピッチ" : `${accentType}型のピッチ`}
          >
            <line className="mora-pitch-guide" x1="0" y1={HIGH_Y} x2={graphWidth} y2={HIGH_Y} />
            <line className="mora-pitch-guide" x1="0" y1={LOW_Y} x2={graphWidth} y2={LOW_Y} />
            <polyline className="mora-pitch-line" points={points.map(({ x, y }) => `${x},${y}`).join(" ")} />
            {points.map(({ x, y }, index) => (
              <circle
                key={index}
                className={index === moras.length ? "mora-pitch-point trailing" : "mora-pitch-point"}
                cx={x}
                cy={y}
                r={index === accentType - 1 ? 6 : 4}
              />
            ))}
            <text className="mora-pitch-trailing-label" x={points.at(-1)?.x} y="72" textAnchor="middle">
              後続音
            </text>
          </svg>

          <div className="mora-accent-buttons" role="group" aria-label="音が下がる位置">
            {moras.map((mora, index) => {
              const value = index + 1;
              const selected = accentType === value;
              return (
                <button
                  key={`${mora}-${index}`}
                  type="button"
                  className={selected ? "selected" : ""}
                  aria-pressed={selected}
                  aria-label={`${value}モーラ目「${mora}」の後で下げる`}
                  onClick={() => onChange(value)}
                >
                  <small>{value}</small>
                  <strong>{mora}</strong>
                  <span>{selected ? "ここで下降" : ""}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <p className="hint accent-editor-hint">モーラを選ぶと、その直後で音が下がります。平板は下降しません。</p>
    </fieldset>
  );
}
