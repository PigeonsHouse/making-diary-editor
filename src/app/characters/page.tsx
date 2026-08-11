"use client";

import { useEffect, useRef, useState } from "react";
import { createCharacter, EDITOR_CONSTANTS } from "@/domain/defaults";
import type { Character } from "@/domain/types";
import { PsdSettings } from "@/components/PsdSettings";
import { VoiceSettingsSliders } from "@/components/VoiceSettingsSliders";
import { useVoicevoxSpeakers } from "@/components/useVoicevoxSpeakers";

type Row = { id: string; revision: number; data: Character };
export default function CharactersPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [selected, setSelected] = useState(0);
  const [status, setStatus] = useState("");
  const { speakers } = useVoicevoxSpeakers();
  const skip = useRef(true);
  useEffect(() => {
    fetch("/api/characters")
      .then((response) => response.json())
      .then((data) => {
        setRows(data);
        skip.current = true;
      });
  }, []);
  const row = rows[selected];
  useEffect(() => {
    if (!row || skip.current) {
      skip.current = false;
      return;
    }
    const timer = setTimeout(async () => {
      setStatus("保存中…");
      const response = await fetch(`/api/characters/${row.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ revision: row.revision, data: row.data }),
      });
      if (!response.ok) return setStatus("保存失敗");
      const updated = await response.json();
      skip.current = true;
      setRows((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setStatus("保存済み");
    }, 700);
    return () => clearTimeout(timer);
  }, [row]);
  const update = (recipe: (draft: Character) => void) => {
    setRows((current) =>
      current.map((item, index) => {
        if (index !== selected) return item;
        const data = structuredClone(item.data);
        recipe(data);
        return { ...item, data };
      }),
    );
    setStatus("未保存");
  };
  const add = async () => {
    const response = await fetch("/api/characters", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(createCharacter()),
    });
    const created = await response.json();
    setRows((current) => [...current, created]);
    setSelected(rows.length);
  };

  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">CHARACTERS</p>
          <h1>キャラクター</h1>
        </div>
        <button className="primary" onClick={add}>
          ＋ 追加
        </button>
      </div>
      <div className="character-layout">
        <aside className="character-list">
          {rows.map((item, index) => (
            <button
              className={index === selected ? "active" : ""}
              key={item.id}
              onClick={() => {
                skip.current = true;
                setSelected(index);
              }}
            >
              <span style={{ background: item.data.color }} />
              {item.data.name}
            </button>
          ))}
        </aside>
        {row ? (
          <section className="character-form">
            <div className="form-title">
              <h2>{row.data.name}</h2>
              <span>{status}</span>
            </div>
            <div className="field-grid">
              <label>
                表示名
                <input
                  value={row.data.name}
                  onChange={(event) =>
                    update((draft) => {
                      draft.name = event.target.value;
                    })
                  }
                />
              </label>
              <label>
                VOICEVOX名
                <select
                  value={row.data.voicevoxName}
                  onChange={(event) =>
                    update((draft) => {
                      draft.voicevoxName = event.target.value;
                      draft.voice.styleName =
                        speakers.find((item) => item.name === event.target.value)?.styles[0]?.name ?? "ノーマル";
                    })
                  }
                >
                  {speakers.map((speaker) => (
                    <option key={speaker.name}>{speaker.name}</option>
                  ))}
                </select>
              </label>
              <label>
                イメージカラー
                <input
                  type="color"
                  value={row.data.color}
                  onChange={(event) =>
                    update((draft) => {
                      draft.color = event.target.value;
                    })
                  }
                />
              </label>
              <label>
                既定スタイル
                <select
                  value={row.data.voice.styleName}
                  onChange={(event) =>
                    update((draft) => {
                      draft.voice.styleName = event.target.value;
                    })
                  }
                >
                  {speakers
                    .find((item) => item.name === row.data.voicevoxName)
                    ?.styles.map((style) => (
                      <option key={style.id}>{style.name}</option>
                    ))}
                </select>
              </label>
              <div className="wide">
                <VoiceSettingsSliders
                  values={row.data.voice}
                  defaults={row.data.voice}
                  onChange={(key, value) => {
                    if (value !== undefined)
                      update((draft) => {
                        draft.voice[key] = value;
                      });
                  }}
                />
              </div>
              <label>
                既定のセリフ前余白
                <input
                  type="number"
                  step="0.1"
                  value={row.data.defaultPauseBeforeSeconds}
                  onChange={(event) =>
                    update((draft) => {
                      draft.defaultPauseBeforeSeconds = Number(event.target.value);
                    })
                  }
                />
              </label>
              <label>
                立ち絵X既定（画面端から）
                <span>
                  <input
                    type="number"
                    value={row.data.avatar.edgeOffsetXPx}
                    onChange={(event) =>
                      update((draft) => {
                        draft.avatar.edgeOffsetXPx = Number(event.target.value);
                      })
                    }
                  />{" "}
                  px
                </span>
              </label>
              <label>
                立ち絵Y既定（覗き量）
                <span>
                  <input
                    type="number"
                    min="0"
                    value={row.data.avatar.peekYPx}
                    onChange={(event) =>
                      update((draft) => {
                        draft.avatar.peekYPx = Number(event.target.value);
                      })
                    }
                  />{" "}
                  px
                </span>
              </label>
              <label className="wide">
                性格・口調
                <textarea
                  value={row.data.personality}
                  onChange={(event) =>
                    update((draft) => {
                      draft.personality = event.target.value;
                    })
                  }
                />
              </label>
              <label className="wide">
                クレジットID（複数可）
                <textarea
                  placeholder={"sm12345678\nim1234567\nnc123456"}
                  value={row.data.creditIds.join("\n")}
                  onChange={(event) =>
                    update((draft) => {
                      draft.creditIds = event.target.value.split("\n");
                    })
                  }
                />
                <small>1行に1つずつ入力できます。</small>
              </label>
            </div>
            <AvatarPositionPreview character={row.data} />
            <PsdSettings character={row.data} update={update} />
          </section>
        ) : (
          <div className="empty-state">キャラクターを追加してください。</div>
        )}
      </div>
    </div>
  );
}

function AvatarPositionPreview({ character }: { character: Character }) {
  const { edgeOffsetXPx, peekYPx, scale, previewUrl } = character.avatar;
  const right = `${(edgeOffsetXPx / EDITOR_CONSTANTS.width) * 100}%`;
  const top = `${((EDITOR_CONSTANTS.height * 0.77 - peekYPx) / EDITOR_CONSTANTS.height) * 100}%`;

  return (
    <section className="avatar-position-preview">
      <div className="avatar-position-preview-heading">
        <strong>立ち絵位置プレビュー</strong>
        <span>右配置時・1920 × 1080基準</span>
      </div>
      <div className="avatar-position-stage">
        {previewUrl ? (
          <img
            src={previewUrl}
            alt={`${character.name}の配置プレビュー`}
            style={{ right, top, height: `${70 * scale}%` }}
          />
        ) : (
          <div className="avatar-position-empty">PSDプレビューを生成すると表示されます</div>
        )}
        <div className="avatar-position-dialogue-mask">
          <span>字幕矩形に隠れる領域</span>
        </div>
      </div>
      <div className="avatar-position-values">
        <span>X {edgeOffsetXPx}px</span>
        <span>Y {peekYPx}px</span>
      </div>
    </section>
  );
}
