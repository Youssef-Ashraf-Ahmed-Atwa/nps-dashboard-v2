import { NextResponse } from "next/server";
import type { ApiError } from "./survey-cleaner";

/** Error body shared by every API route: { error, code?, details? }. */
export const fail = (status: number, error: string, details?: unknown, code?: string) =>
  NextResponse.json<ApiError>({ error, details, code }, { status });
