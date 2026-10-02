import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { supabaseAdmin } from "./supabase/admin";

/**
 * Workspace API keys for the public REST API under /api/v1. A key is `nvk_<43 url-safe chars>`; only its SHA-256 is stored (the key is shown ONCE at
 * creation) plus a short prefix to recognise it. Auth is by key, not by session; a key acts for exactly one workspace and is revocable.
 * The rate limit is per key per minute, counted in Postgres (api_rate_hit), so it holds across serverless instances.
 */
export const API_KEY_SCOPES = ["leads:read", "leads:write", "messages:write", "knowledge:write", "events:read"] as const;
export type ApiScope = (typeof API_KEY_SCOPES)[number];

/** Requests per minute per key. */
export const RATE_LIMIT_PER_MINUTE = 60;

export const hashKey = (key: string): string => createHash("sha256").update(key).digest("hex");

export const newKey = (): { key: string; prefix: string; hash: string } => {
  const key = `nvk_${randomBytes(32).toString("base64url")}`;
  return { key, prefix: key.slice(0, 12), hash: hashKey(key) };
};

export type ApiKeyRow = { id: string; name: string; key_prefix: string; scopes: Array<string>; created_at: string; last_used_at: string | null; revoked_at: string | null };

/** What a verified key stands for. */
export type ApiPrincipal = { readonly keyId: string; readonly workspaceId: string; readonly name: string; readonly scopes: ReadonlyArray<string> };

export type ApiAuth = { readonly ok: true; readonly principal: ApiPrincipal } | { readonly ok: false; readonly status: 401 | 429; readonly code: string; readonly message: string; readonly retryAfter?: number };

/** Verify `Authorization: Bearer <key>` and count one request against the key's minute budget. Updates last_used_at. */
export const authenticate = async (header: string | null): Promise<ApiAuth> => {
  const key = header?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!key || !key.startsWith("nvk_")) {
    return { ok: false, status: 401, code: "unauthorized", message: "Thiếu hoặc sai khoá API. Gửi header Authorization: Bearer <khoá>. (Missing or invalid API key.)" };
  }
  // ONE request: key lookup + this minute's rate hit + last_used_at, in SQL (`api_key_auth`).
  const { data } = await supabaseAdmin().rpc("api_key_auth", { p_hash: hashKey(key) });
  const row = data as { id?: string; workspace_id?: string; name?: string; scopes?: Array<string>; revoked?: boolean; hits?: number } | null;
  if (!row || row.revoked || !row.id || !row.workspace_id) {
    return { ok: false, status: 401, code: row?.revoked ? "key_revoked" : "unauthorized", message: row?.revoked ? "Khoá API này đã bị thu hồi. (This API key was revoked.)" : "Khoá API không đúng. (Invalid API key.)" };
  }
  if ((row.hits ?? 0) > RATE_LIMIT_PER_MINUTE) {
    return { ok: false, status: 429, code: "rate_limited", message: `Quá nhiều yêu cầu (tối đa ${RATE_LIMIT_PER_MINUTE}/phút). Thử lại sau ít giây. (Rate limit exceeded.)`, retryAfter: 60 - new Date().getSeconds() };
  }
  return { ok: true, principal: { keyId: row.id, workspaceId: row.workspace_id, name: row.name ?? "", scopes: row.scopes ?? [] } };
};
