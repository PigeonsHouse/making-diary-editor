import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { renderJobs } from "@/server/db/schema";

type Context = { params: Promise<{ id: string }> };

export async function GET(_: Request, context: Context) {
  const { id } = await context.params;
  const encoder = new TextEncoder();
  let timer: ReturnType<typeof setInterval>;
  const stream = new ReadableStream({
    start(controller) {
      const send = async () => {
        const [row] = await db.select().from(renderJobs).where(eq(renderJobs.id, id));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(row ?? { status: "missing" })}\n\n`));
        if (!row || ["completed", "failed"].includes(row.status)) {
          clearInterval(timer);
          controller.close();
        }
      };
      void send();
      timer = setInterval(() => void send(), 1000);
    },
    cancel() {
      clearInterval(timer);
    },
  });
  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    },
  });
}
