"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "../permissions";
import { assertPublicHost, createDataConnection, loadDataCredential, safeFetch, saveDataCredential } from "../data-hub";
import { supabaseAdmin } from "../supabase/admin";
import type { Outcome } from "../types";
import {
  callOperation, normalizeConfig, openApiFailure, parseAuth, parseConfig, parseJsonBody, summaryOf,
} from "./openapi";
import {
  detectItems, getPath, itemsOf, parseSpecText, suggestFromItems, textOf,
  type AuthSecret, type OpDef, type OpenApiConfig, type ParsedSpec,
} from "@/features/connections/wizard/data/openapi/spec";

/** Server actions of the Swagger / OpenAPI wizard. Owner only; nothing here returns a stored secret to the browser. */

const fail = (e: unknown): { ok: false; error: string } => ({ ok: false, error: e instanceof Error ? e.message : String(e) });
const SPEC_LIMIT = 5_000_000;

/** Reads a spec from a link (https) or pasted text and lists its operations. Saves nothing. */
export const loadOpenApiSpec = async (input: { readonly specUrl: string; readonly specText: string }): Promise<Outcome<ParsedSpec & { readonly specUrl: string }>> => {
  try {
    await requireOwner();
    const specUrl = input.specUrl.trim();
    let text = input.specText;
    if (!text.trim()) {
      if (!specUrl) return { ok: false, error: "Nhập link đặc tả hoặc dán nội dung đặc tả." };
      let url: URL;
      try { url = new URL(specUrl); } catch { return { ok: false, error: "Link đặc tả không hợp lệ." }; }
      if (url.protocol !== "https:" && !(url.protocol === "http:" && process.env.DATA_ALLOW_PRIVATE_HOSTS === "1")) return { ok: false, error: "Link đặc tả phải bắt đầu bằng https://." };
      await assertPublicHost(url.hostname);
      const res = await safeFetch(url.toString(), { headers: { accept: "application/json, application/yaml, text/yaml, */*" }, maxBytes: SPEC_LIMIT });
      if (res.status < 200 || res.status >= 300) return { ok: false, error: `Không tải được đặc tả (lỗi ${res.status}). Kiểm tra lại link.` };
      text = res.text;
    } else if (text.length > SPEC_LIMIT) {
      return { ok: false, error: "Đặc tả quá lớn (hơn 5 MB)." };
    }
    return { ok: true, data: { ...parseSpecText(text, specUrl), specUrl } };
  } catch (e) {
    return fail(e);
  }
};

type AuthInput = { readonly type: string; readonly name: string; readonly value: string; readonly user: string; readonly password: string };

/** The auth the owner typed, with blank secrets filled from the stored credential when the type is unchanged (edit mode). */
const resolveAuth = async (workspaceId: string, input: AuthInput, connectionId?: string): Promise<AuthSecret> => {
  const typed = parseAuth(JSON.stringify(input));
  if (!connectionId) return typed;
  const stored = parseAuth((await loadDataCredential(workspaceId, connectionId)) ?? "");
  if (stored.type !== typed.type) return typed;
  return { ...typed, value: typed.value || stored.value, user: typed.user || stored.user, password: typed.password || stored.password };
};

export type OpenApiTestResult = {
  readonly status: number
  readonly itemCount: number
  readonly itemsPath: string
  readonly idField: string
  readonly titleField: string
  readonly sampleKeys: ReadonlyArray<string>
  readonly error?: string
}

/** "Thử kết nối": calls one GET with the typed settings (nothing saved) and reports the status and the items found. */
export const testOpenApiOperation = async (input: {
  readonly connectionId?: string; readonly baseUrl: string; readonly auth: AuthInput; readonly op: OpDef; readonly fixedQuery: string; readonly itemsPath: string;
}): Promise<Outcome<OpenApiTestResult>> => {
  try {
    const me = await requireOwner();
    const cfg = normalizeConfig({ baseUrl: input.baseUrl, ops: [input.op] });
    const op = cfg.ops[0];
    if (!op || op.method !== "GET") return { ok: false, error: "Chỉ thử được API GET." };
    const auth = await resolveAuth(me.workspaceId, input.auth, input.connectionId);
    const res = await callOperation(cfg.baseUrl, op, auth, {}, { fixedQuery: input.fixedQuery.replace(/^\?/, "").slice(0, 500) });
    if (res.status < 200 || res.status >= 300) return { ok: true, data: { status: res.status, itemCount: 0, itemsPath: "", idField: "", titleField: "", sampleKeys: [], error: openApiFailure(res.status) } };
    let body: unknown;
    try { body = parseJsonBody(res.text); } catch (e) { return { ok: true, data: { status: res.status, itemCount: 0, itemsPath: "", idField: "", titleField: "", sampleKeys: [], error: (e as Error).message } }; }
    const typedPath = input.itemsPath.trim();
    const at = typedPath ? getPath(body, typedPath) : undefined;
    const found = Array.isArray(at) ? { path: typedPath, items: at } : detectItems(body);
    const items = found ? found.items : itemsOf(body, "");
    const first = items.find((x): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x));
    return { ok: true, data: { status: res.status, itemCount: items.length, itemsPath: found?.path ?? "", ...suggestFromItems(items), sampleKeys: first ? Object.keys(first).slice(0, 12) : [] } };
  } catch (e) {
    return fail(e);
  }
};

/** What the wizard needs to continue editing a connection. Never includes secrets. */
export const getOpenApiForEdit = async (connectionId: string): Promise<Outcome<{
  readonly name: string; readonly config: OpenApiConfig; readonly syncEveryMinutes: number | null; readonly hasSecret: boolean; readonly authUser: string;
}>> => {
  try {
    const me = await requireOwner();
    const { data } = await supabaseAdmin().from("connections").select("name, provider, public_meta, sync_every_minutes")
      .eq("id", connectionId).eq("workspace_id", me.workspaceId).maybeSingle<{ name: string; provider: string; public_meta: Record<string, string> | null; sync_every_minutes: number | null }>();
    if (!data || data.provider !== "openapi") return { ok: false, error: "Không tìm thấy kết nối API." };
    const config = parseConfig(data.public_meta?.config);
    if (!config) return { ok: false, error: "Kết nối này chưa có cấu hình." };
    const auth = parseAuth((await loadDataCredential(me.workspaceId, connectionId)) ?? "");
    return { ok: true, data: { name: data.name, config, syncEveryMinutes: data.sync_every_minutes, hasSecret: Boolean(auth.value || auth.password), authUser: auth.user } };
  } catch (e) {
    return fail(e);
  }
};

const SCHEDULES = [null, 15, 60, 360, 1440];

/** Creates the connection (or updates `connectionId`): config in public_meta, auth encrypted. Returns its id. */
export const saveOpenApiConnection = async (input: {
  readonly connectionId?: string; readonly name: string; readonly config: OpenApiConfig; readonly auth: AuthInput; readonly syncEveryMinutes: number | null;
}): Promise<Outcome<{ readonly id: string }>> => {
  try {
    const me = await requireOwner();
    const name = input.name.trim().slice(0, 80);
    if (!name) return { ok: false, error: "Nhập tên cho kết nối." };
    if (!SCHEDULES.includes(input.syncEveryMinutes)) return { ok: false, error: "Chu kỳ đồng bộ không hợp lệ." };
    const config = normalizeConfig({ ...input.config });
    if (!/^https?:\/\/[^\s]+$/i.test(config.baseUrl)) return { ok: false, error: "Địa chỉ gốc (base URL) phải bắt đầu bằng https://." };
    await assertPublicHost(new URL(config.baseUrl).hostname);
    if (config.pulls.length === 0 && config.tools.length === 0) return { ok: false, error: "Chọn ít nhất một API để kéo dữ liệu hoặc cho agent dùng." };
    const auth = await resolveAuth(me.workspaceId, input.auth, input.connectionId);
    if (config.authType !== "none" && !(auth.value || auth.user || auth.password)) return { ok: false, error: "Nhập thông tin xác thực cho API." };
    if ((config.authType === "header" || config.authType === "query") && !config.authName) return { ok: false, error: "Nhập tên header hoặc tham số của khoá API." };
    const credential = JSON.stringify({ type: config.authType, name: config.authName, value: auth.value, user: auth.user, password: auth.password });
    const meta = { config: JSON.stringify(config), summary: summaryOf(config) };
    const db = supabaseAdmin();
    if (input.connectionId) {
      const { data: own } = await db.from("connections").select("id, provider").eq("id", input.connectionId).eq("workspace_id", me.workspaceId).maybeSingle<{ id: string; provider: string }>();
      if (!own || own.provider !== "openapi") return { ok: false, error: "Không tìm thấy kết nối API." };
      await saveDataCredential(own.id, credential);
      const { error } = await db.from("connections").update({
        name, public_meta: meta, status: "connected", last_error: null, sync_every_minutes: input.syncEveryMinutes,
        next_sync_at: input.syncEveryMinutes ? new Date().toISOString() : null,
      }).eq("id", own.id);
      if (error) return { ok: false, error: error.message };
      revalidatePath("/connections");
      return { ok: true, data: { id: own.id } };
    }
    const id = await createDataConnection({ workspaceId: me.workspaceId, userId: me.userId, provider: "openapi", name, meta, credential, syncEveryMinutes: input.syncEveryMinutes });
    revalidatePath("/connections");
    return { ok: true, data: { id } };
  } catch (e) {
    return fail(e);
  }
};
