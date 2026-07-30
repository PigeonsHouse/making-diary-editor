import {readFile} from "node:fs/promises";
import {eq} from "drizzle-orm";
import {NextResponse} from "next/server";
import {db} from "@/server/db";
import {renderJobs} from "@/server/db/schema";

type Context = {params: Promise<{id: string}>};

export async function GET(_: Request, context: Context) {
  const {id} = await context.params;
  const [job] = await db.select().from(renderJobs).where(eq(renderJobs.id, id));
  if (!job?.outputPath || job.status !== "completed") {
    return NextResponse.json({error: "出力がありません"}, {status: 404});
  }
  const content = await readFile(job.outputPath);
  return new NextResponse(content, {
    headers: {
      "content-type": "video/mp4",
      "content-disposition": `attachment; filename="making-diary-${id}.mp4"`,
    },
  });
}
