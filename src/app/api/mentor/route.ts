import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

import { createLocalCoachResponse } from "@/lib/mentor/coach";
import { buildMentorInput, MENTOR_INSTRUCTIONS } from "@/lib/mentor/prompt";
import {
  mentorJsonSchema,
  normalizeStructuredPayload,
  validateAiMentorResponse,
} from "@/lib/mentor/validate";
import { mentorRequestSchema, type MentorRequest, type MentorResponse } from "@/types/music";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 24 * 1024;
const COOKIE_NAME = "hc_mentor_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 8;
const RATE_STATE_LIMIT = 10_000;
const ephemeralSecret = randomBytes(32).toString("base64url");

interface RateState {
  startedAt: number;
  count: number;
}

const rateStates = new Map<string, RateState>();

function signingSecret(): string {
  const configured = process.env.MENTOR_COOKIE_SECRET?.trim();
  return configured && configured.length >= 32 ? configured : ephemeralSecret;
}

function signature(id: string): string {
  return createHmac("sha256", signingSecret()).update(id).digest("base64url");
}

function signSession(id: string): string {
  return `${id}.${signature(id)}`;
}

function verifySession(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const separator = value.lastIndexOf(".");
  if (separator < 1) return undefined;
  const id = value.slice(0, separator);
  const supplied = value.slice(separator + 1);
  if (!/^[0-9a-f-]{36}$/i.test(id)) return undefined;

  const expectedBuffer = Buffer.from(signature(id));
  const suppliedBuffer = Buffer.from(supplied);
  if (
    expectedBuffer.length !== suppliedBuffer.length ||
    !timingSafeEqual(expectedBuffer, suppliedBuffer)
  ) {
    return undefined;
  }
  return id;
}

function sessionFor(request: NextRequest): { id: string; isNew: boolean } {
  const existing = verifySession(request.cookies.get(COOKIE_NAME)?.value);
  return existing ? { id: existing, isNew: false } : { id: randomUUID(), isNew: true };
}

function consumeRateLimit(id: string, now = Date.now()): boolean {
  if (rateStates.size > RATE_STATE_LIMIT) {
    for (const [key, state] of rateStates) {
      if (now - state.startedAt > RATE_WINDOW_MS) rateStates.delete(key);
    }
    if (rateStates.size > RATE_STATE_LIMIT) rateStates.clear();
  }

  const existing = rateStates.get(id);
  if (!existing || now - existing.startedAt >= RATE_WINDOW_MS) {
    rateStates.set(id, { startedAt: now, count: 1 });
    return true;
  }
  if (existing.count >= RATE_LIMIT) return false;
  existing.count += 1;
  return true;
}

function isSameOrigin(request: NextRequest): boolean {
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const originUrl = new URL(origin);
    const requestHost =
      request.headers.get("x-forwarded-host") ??
      request.headers.get("host") ??
      request.nextUrl.host;
    const requestProtocol =
      request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
    return originUrl.host === requestHost && originUrl.protocol === `${requestProtocol}:`;
  } catch {
    return false;
  }
}

async function readBoundedJson(request: NextRequest): Promise<unknown> {
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    throw new Error("body-too-large");
  }
  if (!request.body) throw new Error("body-missing");

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new Error("body-too-large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let cursor = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, cursor);
    cursor += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}

function jsonResponse(
  body: MentorResponse | { error: string },
  options: {
    status?: number;
    mode?: "ai" | "local";
    session?: { id: string; isNew: boolean };
    retryAfter?: number;
  } = {},
): NextResponse {
  const response = NextResponse.json(body, {
    status: options.status ?? 200,
    headers: {
      "cache-control": "private, no-store, max-age=0",
      "x-content-type-options": "nosniff",
      ...(options.mode ? { "x-harmonic-mentor": options.mode } : {}),
      ...(options.retryAfter ? { "retry-after": String(options.retryAfter) } : {}),
    },
  });
  if (options.session?.isNew) {
    response.cookies.set({
      name: COOKIE_NAME,
      value: signSession(options.session.id),
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/api/mentor",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
  }
  return response;
}

function localResponse(
  request: MentorRequest,
  session: { id: string; isNew: boolean },
  retryAfter?: number,
): NextResponse {
  return jsonResponse(createLocalCoachResponse(request), {
    mode: "local",
    session,
    retryAfter,
  });
}

async function requestAiMentor(request: MentorRequest): Promise<MentorResponse | undefined> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return undefined;

  const client = new OpenAI({
    apiKey,
    maxRetries: 0,
    timeout: 8_000,
  });
  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL?.trim() || "gpt-5.6",
    instructions: MENTOR_INSTRUCTIONS,
    input: buildMentorInput(request),
    max_output_tokens: 350,
    reasoning: { effort: "low" },
    store: false,
    text: {
      verbosity: "low",
      format: {
        type: "json_schema",
        name: "harmonic_compass_mentor",
        strict: true,
        schema: mentorJsonSchema(),
      },
    },
  });

  if (!response.output_text) return undefined;
  const payload: unknown = JSON.parse(response.output_text);
  return validateAiMentorResponse(normalizeStructuredPayload(payload), request);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isSameOrigin(request)) {
    return jsonResponse(
      { error: "Cross-origin mentor requests are not allowed." },
      { status: 403 },
    );
  }

  let raw: unknown;
  try {
    raw = await readBoundedJson(request);
  } catch (error) {
    const tooLarge = error instanceof Error && error.message === "body-too-large";
    return jsonResponse(
      { error: tooLarge ? "Request is too large." : "Request body is invalid." },
      { status: tooLarge ? 413 : 400 },
    );
  }

  const parsed = mentorRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return jsonResponse(
      { error: "Mentor context does not match the supported schema." },
      { status: 400 },
    );
  }

  const session = sessionFor(request);
  if (!consumeRateLimit(session.id)) {
    return localResponse(parsed.data, session, 60);
  }

  try {
    const response = await requestAiMentor(parsed.data);
    if (response) {
      return jsonResponse(response, { mode: "ai", session });
    }
  } catch {
    // The local coach is the product fallback; never expose provider details.
  }
  return localResponse(parsed.data, session);
}
