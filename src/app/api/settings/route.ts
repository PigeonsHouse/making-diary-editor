import {eq} from "drizzle-orm";
import {NextResponse} from "next/server";
import {db} from "@/server/db";
import {appSettings} from "@/server/db/schema";

const KEY = "editor";
const defaults = {defaultBlockEndHoldSeconds: 0.5};

export async function GET() {
  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, KEY));
  return NextResponse.json(row?.value ?? defaults);
}

export async function PUT(request: Request) {
  const input = await request.json();
  const value = {
    defaultBlockEndHoldSeconds: Math.max(0, Number(input.defaultBlockEndHoldSeconds ?? 0.5)),
  };
  await db.insert(appSettings).values({key: KEY, value}).onConflictDoUpdate({
    target: appSettings.key,
    set: {value},
  });
  return NextResponse.json(value);
}
