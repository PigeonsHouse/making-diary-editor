import type { RenderJobSummary } from "./useRenderJobs";

const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

const statusLabels: Record<RenderJobSummary["status"], string> = {
  queued: "待機中",
  rendering: "レンダリング中",
  completed: "完了",
  failed: "失敗",
};

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "日時不明" : dateFormatter.format(date);
}

export function RenderDownloadLink({ job, compact = false }: { job: RenderJobSummary; compact?: boolean }) {
  return (
    <a className={`render-download${compact ? " compact" : ""}`} href={`/api/render/${job.id}/download`} download>
      {compact ? "ダウンロード" : "完成動画をダウンロード"}
    </a>
  );
}

export function RenderHistory({ jobs, isLoading }: { jobs: RenderJobSummary[]; isLoading: boolean }) {
  return (
    <details className="render-history">
      <summary>
        <span>レンダリング履歴</span>
        <small>{isLoading ? "読み込み中…" : `${jobs.length}件`}</small>
      </summary>
      <div className="render-history-list">
        {!isLoading && jobs.length === 0 ? <p className="render-history-empty">履歴はまだありません。</p> : null}
        {jobs.map((job) => (
          <div className="render-history-row" key={job.id}>
            <div className="render-history-main">
              <div>
                <span className={`render-status ${job.status}`}>{statusLabels[job.status]}</span>
                {job.status === "queued" || job.status === "rendering" ? (
                  <span className="render-progress">{job.progress}%</span>
                ) : null}
              </div>
              <time dateTime={job.createdAt}>{formatDate(job.createdAt)}</time>
              {job.status === "failed" && job.error ? <p>{job.error}</p> : null}
            </div>
            {job.status === "completed" ? <RenderDownloadLink job={job} compact /> : null}
          </div>
        ))}
      </div>
    </details>
  );
}
