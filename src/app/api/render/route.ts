import {eq} from "drizzle-orm";
import {NextResponse} from "next/server";
import {validateProject} from "@/domain/timeline";
import {db} from "@/server/db";
import {characters, projects, renderJobs} from "@/server/db/schema";
import {apiError} from "@/server/http";
import {renderQueue} from "@/server/queue";

export async function POST(request: Request) {
  try {
    const {projectId} = await request.json();
    const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
    if (!project) return NextResponse.json({error: "プロジェクトが見つかりません"}, {status: 404});
    const characterRows = await db.select().from(characters);
    const issues = validateProject(project.document, characterRows.map((row) => row.data));
    if (issues.length) return NextResponse.json({error: "レンダリング前の修正が必要です", issues}, {status: 422});
    const [job] = await db.insert(renderJobs).values({
      projectId,
      snapshot: project.document,
    }).returning();
    await renderQueue.add("render", {renderJobId: job.id}, {
      jobId: job.id,
      removeOnComplete: 50,
      removeOnFail: 50,
    });
    return NextResponse.json(job, {status: 202});
  } catch (error) {
    return apiError(error);
  }
}

export async function GET(request: Request) {
  const projectId = new URL(request.url).searchParams.get("projectId");
  const rows = projectId
    ? await db.select().from(renderJobs).where(eq(renderJobs.projectId, projectId))
    : await db.select().from(renderJobs);
  return NextResponse.json(rows);
}
