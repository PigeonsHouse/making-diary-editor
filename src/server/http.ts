import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function apiError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json({ error: "入力内容が不正です", details: error.issues }, { status: 400 });
  }
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: error.message, ...(error.details === undefined ? {} : { details: error.details }) },
      { status: error.status },
    );
  }
  console.error(error);
  return NextResponse.json(
    { error: error instanceof Error ? error.message : "サーバーエラーが発生しました" },
    { status: 500 },
  );
}
