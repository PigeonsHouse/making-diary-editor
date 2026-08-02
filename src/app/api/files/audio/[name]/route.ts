import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { parseByteRange } from "@/server/byte-range";

type Context = { params: Promise<{ name: string }> };

export async function GET(request: Request, context: Context) {
  const { name } = await context.params;
  if (!/^[a-f0-9]{64}\.wav$/.test(name)) {
    return NextResponse.json({ error: "Invalid file" }, { status: 400 });
  }
  try {
    const dataDir = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
    const content = await readFile(path.join(dataDir, "audio", name));
    const rangeHeader = request.headers.get("range");
    const range = parseByteRange(rangeHeader, content.byteLength);
    const commonHeaders = {
      "content-type": "audio/wav",
      "cache-control": "public, max-age=31536000, immutable",
      "accept-ranges": "bytes",
    };
    if (rangeHeader && !range) {
      return new NextResponse(null, {
        status: 416,
        headers: { ...commonHeaders, "content-range": `bytes */${content.byteLength}` },
      });
    }

    const start = range?.start ?? 0;
    const end = range?.end ?? content.byteLength - 1;
    const body = content.subarray(start, end + 1);
    return new NextResponse(body, {
      status: range ? 206 : 200,
      headers: {
        ...commonHeaders,
        "content-length": String(body.byteLength),
        ...(range ? { "content-range": `bytes ${start}-${end}/${content.byteLength}` } : {}),
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
