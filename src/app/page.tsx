"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ProjectRecord } from "@/domain/types";

const diaryPeriod = (project: ProjectRecord) => {
  const dates = project.document.diaries
    .map((diary) => diary.date)
    .filter(Boolean)
    .sort();
  if (dates.length === 0) return "日付未設定";
  const format = (date: string) => date.replaceAll("-", ".");
  return `${format(dates[0])}〜${format(dates.at(-1)!)}`;
};

export default function HomePage() {
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [error, setError] = useState("");

  const load = async () => {
    const response = await fetch("/api/projects");
    if (!response.ok) return setError("プロジェクトを読み込めませんでした");
    setProjects(await response.json());
  };
  useEffect(() => {
    void load();
  }, []);

  const create = async () => {
    const response = await fetch("/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "新しい製作日誌" }),
    });
    if (!response.ok) return setError("プロジェクトを作成できませんでした");
    location.href = `/projects/${(await response.json()).id}`;
  };

  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">PROJECTS</p>
          <h1>製作日誌</h1>
          <p className="muted">メモと素材を、週末に一本の動画へ。</p>
        </div>
        <button className="primary" onClick={create}>
          ＋ 新しい動画
        </button>
      </div>
      {error ? <div className="alert error">{error}</div> : null}
      <div className="project-grid">
        {projects.map((project) => (
          <Link href={`/projects/${project.id}`} className="project-card" key={project.id}>
            <div className="project-card-preview">
              <div>
                <span>{project.document.diaries.length}</span> DAYS
              </div>
              <small>{diaryPeriod(project)}</small>
            </div>
            <h2>{project.document.name}</h2>
            <p>{new Date(project.updatedAt).toLocaleString("ja-JP")} 更新</p>
          </Link>
        ))}
        {projects.length === 0 ? (
          <div className="empty-state">まだ動画がありません。「新しい動画」から始めましょう。</div>
        ) : null}
      </div>
    </div>
  );
}
