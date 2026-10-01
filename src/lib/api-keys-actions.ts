"use server";

import { revalidatePath } from "next/cache";
import { newKey, type ApiKeyRow } from "./api-keys";
import { logEvidence } from "./core";
import { requireManager } from "./permissions";
import { supabaseAdmin } from "./supabase/admin";
import type { Outcome } from "./types";

/** Server actions of the /developers page (owner and manager only; every query is scoped to the caller's workspace). */
const run = async <T>(fn: () => Promise<T>): Promise<Outcome<T>> => {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
};

export type ApiKeyView = { id: string; name: string; prefix: string; createdAt: string; lastUsedAt: string | null; revokedAt: string | null };

const view = (r: ApiKeyRow): ApiKeyView => ({ id: r.id, name: r.name, prefix: r.key_prefix, createdAt: r.created_at, lastUsedAt: r.last_used_at, revokedAt: r.revoked_at });

/** The workspace's keys, newest first (never the key itself, which is not stored). */
export const listApiKeys = async (): Promise<Outcome<Array<ApiKeyView>>> =>
  run(async () => {
    const member = await requireManager();
    const { data, error } = await supabaseAdmin().from("workspace_api_keys").select("id, name, key_prefix, scopes, created_at, last_used_at, revoked_at").eq("workspace_id", member.workspaceId).order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return ((data ?? []) as Array<ApiKeyRow>).map(view);
  });

/** Create a key. The key is returned ONCE here: only its hash is stored, so it cannot be shown again. */
export const createApiKey = async (name: string): Promise<Outcome<{ key: string; item: ApiKeyView }>> =>
  run(async () => {
    const member = await requireManager();
    const clean = name.trim().replace(/\s+/g, " ").slice(0, 60);
    if (clean.length < 2) throw new Error("Đặt tên cho khoá (ít nhất 2 ký tự), ví dụ: n8n bán hàng.");
    const db = supabaseAdmin();
    const { count } = await db.from("workspace_api_keys").select("id", { count: "exact", head: true }).eq("workspace_id", member.workspaceId).is("revoked_at", null);
    if ((count ?? 0) >= 20) throw new Error("Đã có 20 khoá đang dùng. Hãy thu hồi bớt khoá không dùng.");
    const k = newKey();
    const { data, error } = await db.from("workspace_api_keys").insert({ workspace_id: member.workspaceId, name: clean, key_prefix: k.prefix, key_hash: k.hash, created_by: member.userId })
      .select("id, name, key_prefix, scopes, created_at, last_used_at, revoked_at").single();
    if (error) throw new Error(error.message);
    await logEvidence(db, member.workspaceId, { kind: "api.key_created", actor: member.displayName, summary: `Tạo khoá API "${clean}"`, evidence: k.prefix });
    revalidatePath("/developers");
    return { key: k.key, item: view(data as ApiKeyRow) };
  });

/** Revoke a key: it stops working at once. The row stays (with its last use) as history. */
export const revokeApiKey = async (id: string): Promise<Outcome<ApiKeyView>> =>
  run(async () => {
    const member = await requireManager();
    const db = supabaseAdmin();
    const { data, error } = await db.from("workspace_api_keys").update({ revoked_at: new Date().toISOString() }).eq("id", id).eq("workspace_id", member.workspaceId).is("revoked_at", null)
      .select("id, name, key_prefix, scopes, created_at, last_used_at, revoked_at").maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Không tìm thấy khoá này, hoặc khoá đã được thu hồi.");
    await logEvidence(db, member.workspaceId, { kind: "api.key_revoked", actor: member.displayName, summary: `Thu hồi khoá API "${(data as ApiKeyRow).name}"`, evidence: (data as ApiKeyRow).key_prefix });
    revalidatePath("/developers");
    return view(data as ApiKeyRow);
  });
