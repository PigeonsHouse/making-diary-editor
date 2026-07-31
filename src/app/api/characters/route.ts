import {asc} from "drizzle-orm";
import {NextResponse} from "next/server";
import {createCharacter} from "@/domain/defaults";
import {characterSchema} from "@/domain/types";
import {db} from "@/server/db";
import {characters} from "@/server/db/schema";
import {apiError} from "@/server/http";

export async function GET() {
  const rows = await db.select().from(characters).orderBy(asc(characters.createdAt));
  return NextResponse.json(rows.map((row) => ({...row, data: characterSchema.parse(row.data)})));
}

export async function POST(request: Request) {
  try {
    const input = await request.json().catch(() => ({}));
    const data = characterSchema.parse({...createCharacter(), ...input});
    const [row] = await db.insert(characters).values({id: data.id, data}).returning();
    return NextResponse.json(row, {status: 201});
  } catch (error) {
    return apiError(error);
  }
}
