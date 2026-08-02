"use client";

import type {CSSProperties} from "react";
import type {Character, ProjectDocument} from "@/domain/types";
import type {UpdateProject} from "./types";

export function CastEditor({
  project,
  characters,
  update,
}: {
  project: ProjectDocument;
  characters: Character[];
  update: UpdateProject;
}) {
  const available = characters.filter((item) => !project.characterIds.includes(item.id));
  return (
    <details className="panel" open>
      <summary>
        <span>登場キャラクター</span>
        <small>{project.characterIds.length}人</small>
      </summary>
      <div className="cast-row">
        {project.characterIds.map((id, index) => {
          const character = characters.find((item) => item.id === id);
          return (
            <div className="cast-chip" key={id} style={{borderColor: character?.color}}>
              <span>{index % 2 === 0 ? "右" : "左"}</span>
              {character?.name ?? "不明"}
              <button
                onClick={() =>
                  update((draft) => {
                    draft.characterIds.splice(index, 1);
                    delete draft.characterAvatarOverrides[id];
                  })
                }
              >
                ×
              </button>
            </div>
          );
        })}
        {available.length ? (
          <select
            value=""
            onChange={(event) =>
              update((draft) => {
                const characterId = event.target.value;
                const index = draft.characterIds.length;
                draft.characterIds.push(characterId);
                draft.characterAvatarOverrides[characterId] = {flipHorizontal: index % 2 === 1};
              })
            }
          >
            <option value="">＋ 追加</option>
            {available.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        ) : null}
      </div>
      <div className="project-character-layout">
        <span>立ち絵位置（この動画で上書き）</span>
        {project.characterIds.map((characterId) => {
          const character = characters.find((item) => item.id === characterId);
          const overrides = project.characterAvatarOverrides[characterId];
          return (
            <label key={characterId} style={{"--character-color": character?.color ?? "#64748b"} as CSSProperties}>
              {character?.name ?? "不明"}
              <span>X</span>
              <input
                type="number"
                placeholder={String(character?.avatar.edgeOffsetXPx ?? 0)}
                value={overrides?.edgeOffsetXPx ?? ""}
                onChange={(event) =>
                  update((draft) => {
                    const values = (draft.characterAvatarOverrides[characterId] ??= {});
                    if (event.target.value === "") delete values.edgeOffsetXPx;
                    else values.edgeOffsetXPx = Number(event.target.value);
                  })
                }
              />
              <span>Y</span>
              <input
                type="number"
                min="0"
                placeholder={String(character?.avatar.peekYPx ?? 180)}
                value={overrides?.peekYPx ?? ""}
                onChange={(event) =>
                  update((draft) => {
                    const values = (draft.characterAvatarOverrides[characterId] ??= {});
                    if (event.target.value === "") delete values.peekYPx;
                    else values.peekYPx = Number(event.target.value);
                  })
                }
              />
              px
              <span className="project-character-flip">
                <input
                  type="checkbox"
                  checked={overrides?.flipHorizontal ?? project.characterIds.indexOf(characterId) % 2 === 1}
                  onChange={(event) =>
                    update((draft) => {
                      const values = (draft.characterAvatarOverrides[characterId] ??= {});
                      values.flipHorizontal = event.target.checked;
                    })
                  }
                />
                左右反転
              </span>
            </label>
          );
        })}
      </div>
    </details>
  );
}
