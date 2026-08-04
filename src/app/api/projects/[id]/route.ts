import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { projectDocumentSchema } from "@/domain/types";
import { db } from "@/server/db";
import { projects } from "@/server/db/schema";
import { apiError } from "@/server/http";
import { assetQueue } from "@/server/queue";

type Context = { params: Promise<{ id: string }> };

export async function GET(_: Request, context: Context) {
  const { id } = await context.params;
  const [row] = await db.select().from(projects).where(eq(projects.id, id));
  if (!row) return NextResponse.json({ error: "プロジェクトが見つかりません" }, { status: 404 });
  return NextResponse.json({ ...row, document: projectDocumentSchema.parse(row.document) });
}

export async function PATCH(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const input = await request.json();
    const document = projectDocumentSchema.parse(input.document);
    const revision = Number(input.revision);
    const [row] = await db
      .update(projects)
      .set({
        document,
        name: document.name,
        revision: revision + 1,
        updatedAt: new Date(),
      })
      .where(and(eq(projects.id, id), eq(projects.revision, revision)))
      .returning();

    if (!row) {
      return NextResponse.json({ error: "別の画面で更新されています。再読み込みしてください" }, { status: 409 });
    }
    await assetQueue
      .add(
        "prepare-project-psd",
        { projectId: id },
        {
          delay: 1_500,
          deduplication: {
            id: `prepare-project-psd-${id}`,
            ttl: 5_000,
            extend: true,
            replace: true,
            keepLastIfActive: true,
          },
          removeOnComplete: 20,
          removeOnFail: 20,
        },
      )
      .catch((error) => console.error(`Failed to schedule PSD preparation for project ${id}`, error));
    return NextResponse.json(row);
  } catch (error) {
    return apiError(error);
  }
}
