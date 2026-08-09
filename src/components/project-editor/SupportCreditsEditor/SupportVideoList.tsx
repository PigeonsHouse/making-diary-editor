"use client";

import { useState } from "react";
import type { ProjectDocument } from "@/domain/types";
import type { UpdateProject } from "../types";
import { defaultStartDate, VIDEO_ID_PATTERN } from "./utils";

type Props = { project: ProjectDocument; update: UpdateProject };

export function SupportVideoList({ project, update }: Props) {
  const [videoId, setVideoId] = useState("");
  const videos = project.supportCredits.videos;
  const duplicate = videos.some((video) => video.videoId === videoId);
  const canAdd = VIDEO_ID_PATTERN.test(videoId) && !duplicate;

  const addVideo = () => {
    if (!canAdd) return;
    update((draft) => draft.supportCredits.videos.push({ videoId, startDate: null }));
    setVideoId("");
  };

  return (
    <div className="support-video-list">
      <strong>動画ID・取得期間</strong>
      {videos.map((video, index) => (
        <div className="support-video-row" key={video.videoId}>
          <code>{video.videoId}</code>
          <label className="support-video-period-toggle">
            <input
              type="checkbox"
              checked={video.startDate !== null}
              onChange={(event) =>
                update((draft) => {
                  draft.supportCredits.videos[index].startDate = event.target.checked ? defaultStartDate(draft) : null;
                })
              }
            />
            開始日指定
          </label>
          {video.startDate === null ? (
            <span className="support-video-period-all">全期間</span>
          ) : (
            <input
              type="date"
              aria-label={`${video.videoId}の開始日`}
              value={video.startDate}
              onChange={(event) =>
                update((draft) => {
                  if (event.target.value) draft.supportCredits.videos[index].startDate = event.target.value;
                })
              }
            />
          )}
          <button
            className="secondary icon"
            disabled={index === 0}
            aria-label={`${video.videoId}を上へ移動`}
            onClick={() =>
              update((draft) => {
                [draft.supportCredits.videos[index - 1], draft.supportCredits.videos[index]] = [
                  draft.supportCredits.videos[index],
                  draft.supportCredits.videos[index - 1],
                ];
              })
            }
          >
            ↑
          </button>
          <button
            className="secondary icon"
            disabled={index === videos.length - 1}
            aria-label={`${video.videoId}を下へ移動`}
            onClick={() =>
              update((draft) => {
                [draft.supportCredits.videos[index], draft.supportCredits.videos[index + 1]] = [
                  draft.supportCredits.videos[index + 1],
                  draft.supportCredits.videos[index],
                ];
              })
            }
          >
            ↓
          </button>
          <button
            className="danger icon"
            aria-label={`${video.videoId}を削除`}
            onClick={() => update((draft) => draft.supportCredits.videos.splice(index, 1))}
          >
            ×
          </button>
        </div>
      ))}
      <div className="support-video-add">
        <input
          value={videoId}
          placeholder="sm12345678"
          aria-label="追加する動画ID"
          className={videoId && (!VIDEO_ID_PATTERN.test(videoId) || duplicate) ? "invalid" : ""}
          onChange={(event) => setVideoId(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") addVideo();
          }}
        />
        <button className="secondary" disabled={!canAdd} onClick={addVideo}>
          追加
        </button>
      </div>
    </div>
  );
}
