"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type RenderJobStatus =
  "queued" | "preparing" | "rendering" | "cancelling" | "completed" | "failed" | "cancelled";

export type RenderJobSummary = {
  id: string;
  projectId: string;
  status: RenderJobStatus;
  progress: number;
  etaMs: number | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
};

const isActive = (job: RenderJobSummary) =>
  job.status === "queued" || job.status === "preparing" || job.status === "rendering" || job.status === "cancelling";

const sortNewestFirst = (jobs: RenderJobSummary[]) =>
  [...jobs].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));

export const formatRenderProgress = (progress: number) => `${progress.toFixed(1)}%`;

export function formatRenderEta(etaMs: number | null) {
  if (etaMs === null || !Number.isFinite(etaMs) || etaMs <= 0) return null;
  const totalSeconds = Math.max(1, Math.ceil(etaMs / 1_000));
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `残り約${hours}時間${minutes}分`;
  if (minutes > 0) return `残り約${minutes}分${seconds}秒`;
  return `残り約${seconds}秒`;
}

export function formatRenderProgressDetails(job: RenderJobSummary) {
  const progress = formatRenderProgress(job.progress);
  const eta = job.status === "rendering" ? formatRenderEta(job.etaMs) : null;
  return eta ? `${progress}・${eta}` : progress;
}

export function getRenderStatusText(job: RenderJobSummary) {
  switch (job.status) {
    case "queued":
      return `待機中 ${formatRenderProgressDetails(job)}`;
    case "preparing":
      return "レンダリング準備中…（ETA計算前）";
    case "rendering":
      return `レンダリング中 ${formatRenderProgressDetails(job)}`;
    case "cancelling":
      return "中断処理中…";
    case "completed":
      return "完成しました";
    case "failed":
      return `失敗: ${job.error ?? "原因を取得できませんでした"}`;
    case "cancelled":
      return "中断しました";
  }
}

export function useRenderJobs(projectId: string) {
  const [jobs, setJobs] = useState<RenderJobSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [requestError, setRequestError] = useState("");
  const eventsRef = useRef<EventSource | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`/api/render?projectId=${encodeURIComponent(projectId)}`);
      if (!response.ok) throw new Error("レンダリング履歴を取得できませんでした");
      setJobs(sortNewestFirst((await response.json()) as RenderJobSummary[]));
      setRequestError("");
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : "レンダリング履歴を取得できませんでした");
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  const updateJob = useCallback((nextJob: RenderJobSummary) => {
    setJobs((current) => {
      const existing = current.some((job) => job.id === nextJob.id);
      return sortNewestFirst(
        existing ? current.map((job) => (job.id === nextJob.id ? nextJob : job)) : [nextJob, ...current],
      );
    });
  }, []);

  const monitor = useCallback(
    (jobId: string) => {
      eventsRef.current?.close();
      const events = new EventSource(`/api/render/${jobId}/events`);
      eventsRef.current = events;
      events.onmessage = (event) => {
        const job = JSON.parse(event.data) as RenderJobSummary | { status: "missing" };
        if (job.status === "missing") {
          events.close();
          eventsRef.current = null;
          setRequestError("レンダリング情報が見つかりません");
          return;
        }
        updateJob(job);
        if (job.status === "completed" || job.status === "failed" || job.status === "cancelled") {
          events.close();
          eventsRef.current = null;
          void refresh();
        }
      };
      events.onerror = () => {
        events.close();
        eventsRef.current = null;
        void refresh();
      };
    },
    [refresh, updateJob],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const hasActiveRender = useMemo(() => jobs.some(isActive), [jobs]);
  const activeJob = useMemo(() => jobs.find(isActive) ?? null, [jobs]);

  useEffect(() => {
    if (!hasActiveRender) return;
    const timer = window.setInterval(() => void refresh(), 2_000);
    return () => window.clearInterval(timer);
  }, [hasActiveRender, refresh]);

  useEffect(
    () => () => {
      eventsRef.current?.close();
    },
    [],
  );

  const startRender = useCallback(async () => {
    if (isStarting || hasActiveRender) return;
    setIsStarting(true);
    setRequestError("");
    try {
      const response = await fetch("/api/render", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const body = (await response.json()) as RenderJobSummary & {
        error?: string;
        job?: RenderJobSummary;
      };
      if (!response.ok) {
        if (body.job) updateJob(body.job);
        setRequestError(body.error ?? "レンダリングを開始できませんでした");
        return;
      }
      updateJob(body);
      monitor(body.id);
    } catch {
      setRequestError("レンダリングを開始できませんでした");
    } finally {
      setIsStarting(false);
    }
  }, [hasActiveRender, isStarting, monitor, projectId, updateJob]);

  const cancelRender = useCallback(
    async (jobId: string) => {
      if (cancellingId) return;
      setCancellingId(jobId);
      setRequestError("");
      try {
        const response = await fetch(`/api/render/${jobId}`, { method: "DELETE" });
        const body = (await response.json()) as RenderJobSummary & {
          error?: string;
          job?: RenderJobSummary;
        };
        if (!response.ok) {
          if (body.job) updateJob(body.job);
          setRequestError(body.error ?? "レンダリングを中断できませんでした");
          return;
        }
        updateJob(body);
        if (body.status === "cancelled") {
          eventsRef.current?.close();
          eventsRef.current = null;
          await refresh();
        }
      } catch {
        setRequestError("レンダリングを中断できませんでした");
      } finally {
        setCancellingId(null);
      }
    },
    [cancellingId, refresh, updateJob],
  );

  const latestJob = jobs[0] ?? null;
  const latestCompletedJob = jobs.find((job) => job.status === "completed") ?? null;
  const statusText = isStarting
    ? "キューへ追加中…"
    : cancellingId
      ? "中断処理中…"
      : requestError || (latestJob ? getRenderStatusText(latestJob) : "");

  return {
    jobs,
    isLoading,
    isStarting,
    cancellingId,
    hasActiveRender,
    activeJob,
    latestCompletedJob,
    statusText,
    startRender,
    cancelRender,
  };
}
