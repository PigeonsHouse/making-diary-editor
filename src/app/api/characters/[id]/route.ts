import {and, eq} from "drizzle-orm";
import {NextResponse} from "next/server";
import {characterSchema} from "@/domain/types";
import {db} from "@/server/db";
import {characters} from "@/server/db/schema";
import {apiError} from "@/server/http";

type Context = {params: Promise<{id: string}>};

export async function PATCH(request: Request, context: Context) {
  try {
    const {id} = await context.params;
    const input = await request.json();
    const data = characterSchema.parse(input.data);
    const revision = Number(input.revision);
    const [row] = await db.update(characters).set({
      data,
      revision: revision + 1,
      updatedAt: new Date(),
    }).where(and(eq(characters.id, id), eq(characters.revision, revision))).returning();
    if (!row) return NextResponse.json({error: "競合が発生しました"}, {status: 409});
    return NextResponse.json(row);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_: Request, context: Context) {
  const {id} = await context.params;
  await db.delete(characters).where(eq(characters.id, id));
  return new NextResponse(null, {status: 204});
}
