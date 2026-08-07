import { and, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { renderJobs } from "@/server/db/schema";
import { apiError } from "@/server/http";
import { renderQueue } from "@/server/queue";
import { clearRenderCancellation, requestRenderCancellation } from "@/server/render-cancellation";

type Context = { params: Promise<{ id: string }> };

export async function DELETE(_: Request, context: Context) {
  try {
    const { id } = await context.params;
    const [current] = await db.select().from(renderJobs).where(eq(renderJobs.id, id));
    if (!current) return NextResponse.json({ error: "レンダリング情報が見つかりません" }, { status: 404 });
    if (current.status === "cancelled") return NextResponse.json(current);
    if (current.status === "cancelling") {
      await requestRenderCancellation(id);
      return NextResponse.json(current);
    }
    if (!["queued", "preparing", "rendering"].includes(current.status)) {
      return NextResponse.json({ error: "このレンダリングは中断できません", job: current }, { status: 409 });
    }

    // 先に通知を置くことで、待機中から実行中へ切り替わる瞬間の競合にも対応する。
    await requestRenderCancellation(id);
    let removedFromQueue = false;
    const queueJob = await renderQueue.getJob(id);
    if (queueJob) {
      try {
        await queueJob.remove();
        removedFromQueue = true;
      } catch {
        // active jobはremoveできないため、ワーカー側のキャンセルシグナルに任せる。
      }
    }

    const stoppedBeforeExecution =
      removedFromQueue || (!queueJob && (current.status === "queued" || current.status === "preparing"));
    const nextStatus = stoppedBeforeExecution ? "cancelled" : "cancelling";
    const [cancelledOrCancelling] = await db
      .update(renderJobs)
      .set({ status: nextStatus, etaMs: null, error: null, updatedAt: new Date() })
      .where(and(eq(renderJobs.id, id), inArray(renderJobs.status, ["queued", "preparing", "rendering"])))
      .returning();
    if (stoppedBeforeExecution) await clearRenderCancellation(id);
    if (cancelledOrCancelling) return NextResponse.json(cancelledOrCancelling);

    const [latest] = await db.select().from(renderJobs).where(eq(renderJobs.id, id));
    if (latest?.status === "cancelling") return NextResponse.json(latest);
    if (latest?.status === "cancelled") {
      await clearRenderCancellation(id);
      return NextResponse.json(latest);
    }
    await clearRenderCancellation(id);
    return NextResponse.json({ error: "このレンダリングは中断できません", job: latest }, { status: 409 });
  } catch (error) {
    return apiError(error);
  }
}
