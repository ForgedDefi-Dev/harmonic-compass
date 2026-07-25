import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET(): NextResponse {
  return NextResponse.json(
    {
      status: "ok",
      service: "harmonic-compass",
      version: "1.0.0",
      mentor: process.env.OPENAI_API_KEY ? "available" : "local",
      timestamp: new Date().toISOString(),
    },
    {
      headers: {
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      },
    },
  );
}
