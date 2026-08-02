"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type RenderJobStatus = "queued" | "rendering" | "completed" | "failed";

export type RenderJobSummary = {
  id: string;
  projectId: string;
  status: RenderJobStatus;
  progress: number;
  error: string | null;
  createdAt: string;
  updatedAt: string;
};

const isActive = (job: RenderJobSummary) => job.status === "queued" || job.status === "rendering";

const sortNewestFirst = (jobs: RenderJobSummary[]) =>
  [...jobs].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));

export function getRenderStatusText(job: RenderJobSummary) {
  switch (job.status) {
    case "queued":
      return `待機中 ${job.progress}%`;
    case "rendering":
      return `レンダリング中 ${job.progress}%`;
    case "completed":
      return "完成しました";
    case "failed":
      return `失敗: ${job.error ?? "原因を取得できませんでした"}`;
  }
}

export function useRenderJobs(projectId: string) {
  const [jobs, setJobs] = useState<RenderJobSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
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
        if (job.status === "completed" || job.status === "failed") {
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
      const body = (await response.json()) as RenderJobSummary & { error?: string };
      if (!response.ok) {
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

  const latestJob = jobs[0] ?? null;
  const latestCompletedJob = jobs.find((job) => job.status === "completed") ?? null;
  const statusText = isStarting ? "キューへ追加中…" : requestError || (latestJob ? getRenderStatusText(latestJob) : "");

  return {
    jobs,
    isLoading,
    isStarting,
    hasActiveRender,
    latestCompletedJob,
    statusText,
    startRender,
  };
}
