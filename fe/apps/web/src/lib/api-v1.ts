import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { authenticate, type ApiPrincipal, type ApiScope } from "./api-keys";

/**
 * Shared plumbing of the public REST API under /api/v1: Bearer-key authentication with a per-key rate limit (Postgres), the scope check, JSON body parsing and
 * ONE error shape: { "error": { "code": "<english_code>", "message": "<tiếng Việt>" } }. Success is { "data": ... }.
 */
export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
  }
}

export const apiError = (status: number, code: string, message: string, headers?: Record<string, string>): NextResponse =>
  NextResponse.json({ error: { code, message } }, { status, headers: { "cache-control": "no-store", ...headers } });

export const apiOk = (data: unknown, status = 200): NextResponse => NextResponse.json({ data }, { status, headers: { "cache-control": "no-store" } });

/** Run an endpoint: authenticate, check the scope, call the handler, turn any ApiError (or surprise) into the JSON error shape. */
export const handle = async (request: NextRequest, scope: ApiScope, fn: (who: ApiPrincipal) => Promise<NextResponse>): Promise<NextResponse> => {
  try {
    const auth = await authenticate(request.headers.get("authorization"));
    if (!auth.ok) return apiError(auth.status, auth.code, auth.message, auth.retryAfter ? { "retry-after": String(auth.retryAfter) } : undefined);
    if (!auth.principal.scopes.includes(scope)) return apiError(403, "forbidden_scope", `Khoá này không có quyền "${scope}".`);
    return await fn(auth.principal);
  } catch (e) {
    if (e instanceof ApiError) return apiError(e.status, e.code, e.message);
    console.error("api v1 error:", e instanceof Error ? e.message : e);
    return apiError(500, "internal_error", "Có lỗi ở phía NIVO. Thử lại sau ít phút. (Internal error.)");
  }
};

/** The JSON object of a request body, or a 400. */
export const jsonBody = async (request: NextRequest): Promise<Record<string, unknown>> => {
  const raw = await request.text();
  if (raw.length > 200_000) throw new ApiError(413, "payload_too_large", "Nội dung gửi lên quá lớn (tối đa 200 KB).");
  try {
    const v = JSON.parse(raw) as unknown;
    if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  } catch {
    // falls through
  }
  throw new ApiError(400, "invalid_json", "Nội dung gửi lên phải là một đối tượng JSON hợp lệ.");
};

/** A trimmed string field, optionally required, clipped to `max`. */
export const field = (body: Record<string, unknown>, key: string, opts: { required?: boolean; max?: number } = {}): string => {
  const v = body[key];
  const s = typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "";
  if (opts.required && !s) throw new ApiError(400, "invalid_request", `Thiếu trường "${key}".`);
  if (opts.max && s.length > opts.max) throw new ApiError(400, "invalid_request", `Trường "${key}" dài quá ${opts.max} ký tự.`);
  return s;
};
