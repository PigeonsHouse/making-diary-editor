import { NextResponse } from "next/server";

export async function GET() {
  try {
    const host = process.env.VOICEVOX_URL ?? "http://localhost:50021";
    const response = await fetch(new URL("/speakers", host), { cache: "no-store" });
    if (!response.ok) throw new Error(`VOICEVOX: ${response.status}`);
    const speakers = await response.json();
    return NextResponse.json(
      speakers.map((speaker: { name: string; styles: Array<{ name: string; id: number }> }) => ({
        name: speaker.name,
        styles: speaker.styles.map((style) => ({ name: style.name, id: style.id })),
      })),
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "VOICEVOXへ接続できません" },
      { status: 503 },
    );
  }
}
