import "server-only";
import { createHash } from "node:crypto";
import { loadDataCredential, safeFetch, type Connector, type Entity, type RecordInput } from "../data-hub";
import { supabaseAdmin } from "../supabase/admin";
import {
  getPath, itemsOf, textOf, METHODS, PULL_ENTITIES,
  type AuthSecret, type AuthType, type OpDef, type OpenApiConfig, type PullConfig,
} from "@/features/connections/wizard/data/openapi/spec";

/** Swagger / OpenAPI: pull the chosen GET endpoints into the hub; agents may call the endpoints the owner allowed. */

const MAX_PAGES = 20;
const PAGE_SIZE = 100;
const TOOL_BODY_LIMIT = 20 * 1024;
const AUTH_TYPES: ReadonlyArray<AuthType> = ["none", "header", "query", "bearer", "basic"];

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);
const s = (v: unknown, max = 500) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/* ------------------------------------------------------------------ config and credential */

/** The config JSON of a connection's `public_meta.config`, checked (null when missing or broken). */
export const parseConfig = (raw: string | undefined | null): OpenApiConfig | null => {
  if (!raw) return null;
  let j: unknown;
  try { j = JSON.parse(raw); } catch { return null; }
  return isObj(j) ? normalizeConfig(j) : null;
};

/** Cleans a config that came from the browser or storage: unknown values are dropped, never trusted. */
export const normalizeConfig = (j: Json): OpenApiConfig => {
  const ops: OpDef[] = (Array.isArray(j.ops) ? j.ops : []).filter(isObj).flatMap((o): OpDef[] => {
    const method = s(o.method).toUpperCase();
    const path = s(o.path, 500);
    const id = s(o.id, 80);
    if (!METHODS.includes(method as OpDef["method"]) || !path.startsWith("/") || !id) return [];
    const params = (Array.isArray(o.params) ? o.params : []).filter(isObj).flatMap((p) => {
      const where = s(p.in);
      return (where === "path" || where === "query" || where === "header") && s(p.name, 100)
        ? [{ name: s(p.name, 100), in: where as "path" | "query" | "header", required: p.required === true }] : [];
    });
    return [{ id, method: method as OpDef["method"], path, summary: s(o.summary, 120), params, hasBody: o.hasBody === true }];
  });
  const known = new Set(ops.map((o) => o.id));
  const pulls: PullConfig[] = (Array.isArray(j.pulls) ? j.pulls : []).filter(isObj).flatMap((p): PullConfig[] => {
    const op = ops.find((o) => o.id === s(p.opId));
    if (!op || op.method !== "GET") return [];
    const entity = s(p.entity);
    return [{
      opId: op.id, entity: PULL_ENTITIES.includes(entity as PullConfig["entity"]) ? (entity as PullConfig["entity"]) : "other",
      itemsPath: s(p.itemsPath, 200), idField: s(p.idField, 200), titleField: s(p.titleField, 200), fixedQuery: s(p.fixedQuery, 500).replace(/^\?/, ""),
    }];
  });
  const tools = (Array.isArray(j.tools) ? j.tools : []).map((t) => s(t, 80)).filter((t) => known.has(t));
  const authType = s(j.authType);
  return {
    v: 1, specUrl: s(j.specUrl, 1000), baseUrl: s(j.baseUrl, 1000).replace(/\/+$/, ""),
    authType: AUTH_TYPES.includes(authType as AuthType) ? (authType as AuthType) : "none", authName: s(j.authName, 100),
    ops, pulls, tools: [...new Set(tools)],
  };
};

/** The short line shown on the connection card. */
export const summaryOf = (cfg: OpenApiConfig) => `${cfg.pulls.length} API kéo dữ liệu · ${cfg.tools.length} API cho agent`;

export const parseAuth = (raw: string): AuthSecret => {
  let j: unknown = {};
  try { j = JSON.parse(raw); } catch { /* empty credential */ }
  const o = isObj(j) ? j : {};
  const type = s(o.type);
  return {
    type: AUTH_TYPES.includes(type as AuthType) ? (type as AuthType) : "none", name: s(o.name, 100),
    value: typeof o.value === "string" ? o.value : "", user: typeof o.user === "string" ? o.user : "", password: typeof o.password === "string" ? o.password : "",
  };
};

/* ------------------------------------------------------------------ requests */

const failure = (status: number) =>
  status === 401 || status === 403 ? `API trả về lỗi ${status}: kiểm tra lại khoá API hoặc quyền truy cập.`
  : status === 404 ? "API trả về lỗi 404: kiểm tra lại địa chỉ gốc (base URL) và đường dẫn."
  : status === 429 ? "API trả về lỗi 429: bị giới hạn số lần gọi, hãy thử lại sau."
  : `API trả về lỗi ${status}.`;

/** Builds the URL and headers of one call. `input` holds path/query parameters by name, plus `body`. */
const buildRequest = (baseUrl: string, op: OpDef, auth: AuthSecret, input: Json, fixedQuery = "") => {
  if (!/^https?:\/\//i.test(baseUrl)) throw new Error("Địa chỉ gốc (base URL) phải bắt đầu bằng https://.");
  let path = op.path;
  for (const p of op.params.filter((q) => q.in === "path")) {
    const v = input[p.name];
    if (v === undefined || v === null || v === "") throw new Error(`Thiếu tham số đường dẫn ${p.name}.`);
    path = path.split(`{${p.name}}`).join(encodeURIComponent(String(v)));
  }
  const url = new URL(baseUrl.replace(/\/+$/, "") + path);
  for (const [k, v] of new URLSearchParams(fixedQuery)) url.searchParams.set(k, v);
  for (const p of op.params.filter((q) => q.in === "query")) {
    const v = input[p.name];
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(p.name, String(v));
  }
  const headers: Record<string, string> = { accept: "application/json" };
  if (auth.type === "header" && auth.name && auth.value) headers[auth.name] = auth.value;
  else if (auth.type === "query" && auth.name && auth.value) url.searchParams.set(auth.name, auth.value);
  else if (auth.type === "bearer" && auth.value) headers.authorization = `Bearer ${auth.value}`;
  else if (auth.type === "basic" && (auth.user || auth.password)) headers.authorization = `Basic ${Buffer.from(`${auth.user}:${auth.password}`).toString("base64")}`;
  let body: string | undefined;
  if (op.method !== "GET" && input.body !== undefined) {
    body = typeof input.body === "string" ? input.body : JSON.stringify(input.body);
    headers["content-type"] = "application/json";
  }
  return { url, headers, body };
};

/** One call to an operation. Returns the status, headers and raw text; never throws on a non-2xx status. */
export const callOperation = (baseUrl: string, op: OpDef, auth: AuthSecret, input: Json, opts: { fixedQuery?: string; maxBytes?: number } = {}) => {
  const { url, headers, body } = buildRequest(baseUrl, op, auth, input, opts.fixedQuery);
  return safeFetch(url.toString(), { method: op.method, headers, body, timeoutMs: 15_000, maxBytes: opts.maxBytes ?? 5_000_000 });
};

export const parseJsonBody = (text: string): unknown => {
  try { return JSON.parse(text); } catch { throw new Error("API không trả về JSON, nên NIVO chưa đọc được dữ liệu."); }
};

/* ------------------------------------------------------------------ pagination */

const PAGE_PARAMS = ["page", "pageNumber", "page_number", "pageIndex", "p"];
const LIMIT_PARAMS = ["limit", "per_page", "perPage", "pageSize", "page_size", "size", "take", "top", "count", "maxResults"];
const OFFSET_PARAMS = ["offset", "skip", "start"];
const NEXT_PATHS = ["next", "links.next", "_links.next.href", "paging.next", "pagination.next", "meta.next", "@odata.nextLink", "nextPage", "next_page_url", "next_url"];

const nextLinkOf = (body: unknown, headers: Headers, base: URL): URL | null => {
  const candidates: string[] = [];
  for (const p of NEXT_PATHS) {
    const v = getPath(body, p);
    if (typeof v === "string" && v) candidates.push(v);
    else if (isObj(v) && typeof v.href === "string") candidates.push(v.href);
  }
  const link = headers.get("link")?.match(/<([^>]+)>\s*;\s*rel="?next"?/i);
  if (link) candidates.push(link[1] as string);
  for (const c of candidates) {
    try { return new URL(c, base); } catch { /* try the next one */ }
  }
  return null;
};

const idOf = (item: unknown, pull: PullConfig): string => {
  if (!isObj(item)) return createHash("sha1").update(JSON.stringify(item) ?? "").digest("hex").slice(0, 24);
  const picked = textOf(getPath(item, pull.idField));
  if (picked) return picked;
  for (const k of ["id", "_id", "uuid", "code", "sku"]) {
    const v = textOf(item[k]);
    if (v) return v;
  }
  return createHash("sha1").update(JSON.stringify(item)).digest("hex").slice(0, 24);
};

const DATE_FIELDS = ["updated_at", "updatedAt", "modified_at", "created_at", "createdAt", "date", "timestamp"];

const toRecord = (item: unknown, pull: PullConfig): RecordInput => {
  const data = isObj(item) ? item : { value: item };
  const title = textOf(getPath(item, pull.titleField)) || textOf(data.name) || textOf(data.title);
  let occurredAt: string | null = null;
  for (const f of DATE_FIELDS) {
    const v = data[f];
    if (typeof v === "string" && !Number.isNaN(Date.parse(v))) { occurredAt = v; break; }
  }
  return { externalId: idOf(item, pull), title, occurredAt, data };
};

/** Pulls one operation, page after page (at most 20), and upserts each page. Returns the number of rows. */
const pullOperation = async (cfg: OpenApiConfig, auth: AuthSecret, op: OpDef, pull: PullConfig, ctx: { upsert: (e: Entity, rows: ReadonlyArray<RecordInput>) => Promise<number>; signal: AbortSignal }): Promise<number> => {
  const names = new Set(op.params.filter((p) => p.in === "query").map((p) => p.name));
  const fixed = new URLSearchParams(pull.fixedQuery);
  const pageParam = PAGE_PARAMS.find((n) => names.has(n) && !fixed.has(n));
  const limitParam = LIMIT_PARAMS.find((n) => names.has(n) && !fixed.has(n));
  const offsetParam = pageParam ? undefined : OFFSET_PARAMS.find((n) => names.has(n) && !fixed.has(n));
  const pageStart = pageParam === "pageIndex" ? 0 : 1;
  const origin = new URL(cfg.baseUrl).origin;

  let total = 0;
  let nextUrl: URL | null = null;
  let firstId = "";
  for (let page = 0; page < MAX_PAGES; page++) {
    if (ctx.signal.aborted) break;
    const input: Json = {};
    if (limitParam) input[limitParam] = PAGE_SIZE;
    if (pageParam) input[pageParam] = pageStart + page;
    if (offsetParam) input[offsetParam] = page * PAGE_SIZE;
    let res: Awaited<ReturnType<typeof callOperation>>;
    if (nextUrl) {
      const { headers } = buildRequest(cfg.baseUrl, op, auth, input, pull.fixedQuery);
      if (auth.type === "query" && auth.name && auth.value) nextUrl.searchParams.set(auth.name, auth.value);
      res = await safeFetch(nextUrl.toString(), { method: "GET", headers, timeoutMs: 15_000 });
    } else {
      res = await callOperation(cfg.baseUrl, op, auth, input, { fixedQuery: pull.fixedQuery });
    }
    if (res.status < 200 || res.status >= 300) throw new Error(failure(res.status));
    const body = parseJsonBody(res.text);
    const items = itemsOf(body, pull.itemsPath);
    const rows = new Map<string, RecordInput>();
    for (const item of items) { const r = toRecord(item, pull); rows.set(r.externalId, r); }
    const firstOfPage = items.length ? idOf(items[0], pull) : "";
    if (page > 0 && firstOfPage && firstOfPage === firstId) break; // the API ignores the page parameter
    if (page === 0) firstId = firstOfPage;
    if (rows.size) total += await ctx.upsert(pull.entity, [...rows.values()]);
    if (!items.length) break;
    // A next link is followed only on the same host as the base URL, so the credential never goes elsewhere.
    const link = nextLinkOf(body, res.headers, nextUrl ?? new URL(cfg.baseUrl));
    if (link && link.origin === origin && link.toString() !== nextUrl?.toString()) { nextUrl = link; continue; }
    nextUrl = null;
    if (!pageParam && !offsetParam) break;
    if (limitParam && items.length < PAGE_SIZE) break;
    if (!limitParam && items.length < 10) break;
  }
  return total;
};

export const connector: Connector = {
  sync: async (ctx) => {
    const cfg = parseConfig(ctx.connection.meta.config);
    if (!cfg) throw new Error("Cấu hình kết nối chưa đầy đủ: mở kết nối và lưu lại.");
    if (cfg.pulls.length === 0) throw new Error("Chưa chọn API nào để kéo dữ liệu định kỳ.");
    const auth = parseAuth(ctx.credential);
    let rows = 0;
    const errors: string[] = [];
    for (const pull of cfg.pulls) {
      if (ctx.signal.aborted) break;
      const op = cfg.ops.find((o) => o.id === pull.opId);
      if (!op) continue;
      try {
        rows += await pullOperation(cfg, auth, op, pull, ctx);
      } catch (e) {
        errors.push(`${op.method} ${op.path}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    if (errors.length >= cfg.pulls.length) throw new Error(errors[0]);
    return { rows, ...(errors.length ? { note: errors.join(" | ").slice(0, 400) } : {}) };
  },
};

/* ------------------------------------------------------------------ agent tools */

export type OpenApiTool = { readonly operationId: string; readonly method: string; readonly path: string; readonly summary: string; readonly params: OpDef["params"]; readonly hasBody: boolean; readonly needsApproval: boolean };

const loadOwn = async (workspaceId: string, connectionId: string) => {
  const { data } = await supabaseAdmin().from("connections").select("id, provider, status, public_meta")
    .eq("id", connectionId).eq("workspace_id", workspaceId).maybeSingle<{ id: string; provider: string; status: string; public_meta: Record<string, string> | null }>();
  if (!data || data.provider !== "openapi" || data.status === "disconnected") throw new Error("Không tìm thấy kết nối API.");
  const cfg = parseConfig(data.public_meta?.config);
  if (!cfg) throw new Error("Kết nối API chưa được cấu hình.");
  return cfg;
};

/** The operations the owner allowed agents to call on this connection. Non-GET ones have `needsApproval` (always ask first). */
export const listOpenApiTools = async (workspaceId: string, connectionId: string): Promise<ReadonlyArray<OpenApiTool>> => {
  const cfg = await loadOwn(workspaceId, connectionId);
  return cfg.ops.filter((o) => cfg.tools.includes(o.id)).map((o) => ({
    operationId: o.id, method: o.method, path: o.path, summary: o.summary, params: o.params, hasBody: o.hasBody, needsApproval: o.method !== "GET",
  }));
};

/**
 * Lets an agent call ONE operation of an OpenAPI connection. Only operations the owner ticked as tools are allowed; anything
 * else throws. `params` holds path and query parameters by name, plus `body` (JSON) for POST/PUT/PATCH. The call goes through
 * safeFetch (public hosts only, 15 s, 5 MB) with the connection's stored credential. Returns `{ status, body }` where body
 * is the response text cut to 20 KB. The caller must ask the owner first for non-GET operations (see `listOpenApiTools`).
 */
export const callOpenApiTool = async (workspaceId: string, connectionId: string, operationId: string, params: Record<string, unknown> = {}): Promise<{ status: number; body: string }> => {
  const cfg = await loadOwn(workspaceId, connectionId);
  const op = cfg.ops.find((o) => o.id === operationId);
  if (!op || !cfg.tools.includes(op.id)) throw new Error("API này chưa được cho phép dùng cho agent.");
  const credential = await loadDataCredential(workspaceId, connectionId);
  const res = await callOperation(cfg.baseUrl, op, parseAuth(credential ?? ""), params);
  const body = res.text.length > TOOL_BODY_LIMIT ? `${res.text.slice(0, TOOL_BODY_LIMIT)}\n[đã cắt bớt]` : res.text;
  return { status: res.status, body };
};

export { failure as openApiFailure };
