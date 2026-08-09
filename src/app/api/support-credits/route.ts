import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/server/http";
import { fetchSupportCredits } from "@/server/niconico-support";

const schema = z.object({
  videos: z
    .array(
      z.object({
        videoId: z.string().regex(/^[a-z]{2}[1-9][0-9]*$/),
        startDate: z.string().date().nullable(),
      }),
    )
    .min(1),
});

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    return NextResponse.json(await fetchSupportCredits(input.videos));
  } catch (error) {
    return apiError(error);
  }
}
