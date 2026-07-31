import {desc} from "drizzle-orm";
import {NextResponse} from "next/server";
import {createProject} from "@/domain/defaults";
import {projectDocumentSchema} from "@/domain/types";
import {db} from "@/server/db";
import {projects} from "@/server/db/schema";
import {apiError} from "@/server/http";

export async function GET() {
  const rows = await db.select().from(projects).orderBy(desc(projects.updatedAt));
  return NextResponse.json(rows.map((row) => ({...row, document: projectDocumentSchema.parse(row.document)})));
}

export async function POST(request: Request) {
  try {
    const input = await request.json().catch(() => ({}));
    const document = projectDocumentSchema.parse(createProject(input.name));
    const [row] = await db.insert(projects).values({
      name: document.name,
      document,
    }).returning();
    return NextResponse.json(row, {status: 201});
  } catch (error) {
    return apiError(error);
  }
}
