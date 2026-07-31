import {readFile} from "node:fs/promises";
import path from "node:path";
import {NextResponse} from "next/server";

export async function GET(_: Request, {params}: {params: Promise<{name: string}>}) {
  const {name} = await params;
  if (!/^[a-f0-9]{64}\.png$/.test(name)) return new NextResponse(null, {status: 400});
  try {
    const dataDir = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
    return new NextResponse(await readFile(path.join(dataDir, "psd-previews", name)), {
      headers: {"content-type": "image/png", "cache-control": "public, max-age=31536000, immutable"},
    });
  } catch { return new NextResponse(null, {status: 404}); }
}
