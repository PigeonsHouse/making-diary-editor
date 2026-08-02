import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

type Context = { params: Promise<{ name: string }> };

export async function GET(_: Request, context: Context) {
  const { name } = await context.params;
  if (!/^[a-f0-9]{64}\.wav$/.test(name)) {
    return NextResponse.json({ error: "Invalid file" }, { status: 400 });
  }
  try {
    const dataDir = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
    const content = await readFile(path.join(dataDir, "audio", name));
    return new NextResponse(content, {
      headers: { "content-type": "audio/wav", "cache-control": "public, max-age=31536000, immutable" },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
