import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function apiError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json({ error: "入力内容が不正です", details: error.issues }, { status: 400 });
  }
  console.error(error);
  return NextResponse.json(
    { error: error instanceof Error ? error.message : "サーバーエラーが発生しました" },
    { status: 500 },
  );
}
