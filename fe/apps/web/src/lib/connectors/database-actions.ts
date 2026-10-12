"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "../permissions";
import { createDataConnection, loadDataCredential, saveDataCredential } from "../data-hub";
import { supabaseAdmin } from "../supabase/admin";
import type { Outcome } from "../types";
import { asPlainError, cleanConfig, listTables, parseTarget, previewRows, summaryOf, withSession } from "./database";
import {
  ENGINES,
  type DbTarget, type PreviewRows, type SavedDatabase, type TableInfo, type TableMapping,
} from "@/features/connections/wizard/data/database/types";

/** Server actions of the database wizard. Owner only, scoped to the signed-in workspace; the password never goes back to the browser. */

const fail = (e: unknown): { ok: false; error: string } => ({ ok: false, error: e instanceof Error ? e.message : String(e) });

type Stored = { readonly target: DbTarget };

/** The workspace's own database connection, or an error. */
const ownDatabase = async (workspaceId: string, connectionId: string) => {
  const { data } = await supabaseAdmin().from("connections").select("id, name, provider, public_meta, sync_every_minutes").eq("id", connectionId).eq("workspace_id", workspaceId).maybeSingle<{ id: string; name: string; provider: string; public_meta: Record<string, string> | null; sync_every_minutes: number | null }>();
  if (!data || data.provider !== "database") throw new Error("Không tìm thấy kết nối cơ sở dữ liệu.");
  return data;
};

const storedTarget = async (workspaceId: string, connectionId: string): Promise<Stored | null> => {
  const raw = await loadDataCredential(workspaceId, connectionId);
  if (!raw) return null;
  try { return { target: parseTarget(raw) }; } catch { return null; }
};

/** The target to connect with: the typed password, or (blank) the stored one when it is the same server, engine and user. */
const resolveTarget = async (workspaceId: string, connectionId: string | undefined, t: DbTarget): Promise<DbTarget> => {
  const typed: DbTarget = { ...t, host: t.host.trim(), database: t.database.trim(), user: t.user.trim(), port: Number(t.port), ssl: Boolean(t.ssl) };
  if (typed.password || !connectionId) return typed;
  await ownDatabase(workspaceId, connectionId);
  const s = await storedTarget(workspaceId, connectionId);
  if (!s || s.target.engine !== typed.engine || s.target.host !== typed.host || s.target.user !== typed.user) throw new Error("Nhập mật khẩu của người dùng này.");
  return { ...typed, password: s.target.password };
};

/** "Kiểm tra kết nối": connects read only and lists the tables. */
export const testDatabase = async (input: { connectionId?: string; target: DbTarget }): Promise<Outcome<{ tables: ReadonlyArray<TableInfo> }>> => {
  try {
    const me = await requireOwner();
    const target = await resolveTarget(me.workspaceId, input.connectionId, input.target);
    const tables = await withSession(target, listTables);
    if (tables.length === 0) return { ok: false, error: "Kết nối được nhưng người dùng này không thấy bảng nào; cấp quyền SELECT cho người dùng." };
    return { ok: true, data: { tables } };
  } catch (e) { return fail(e); }
};

/** The first 5 rows of one mapped table. */
export const previewDatabaseTable = async (input: { connectionId?: string; target: DbTarget; mapping: TableMapping }): Promise<Outcome<PreviewRows>> => {
  try {
    const me = await requireOwner();
    const target = await resolveTarget(me.workspaceId, input.connectionId, input.target);
    const mapping = cleanConfig({ tables: [input.mapping] }).tables[0] as TableMapping;
    const r = await withSession(target, (s) => previewRows(s, mapping, 5));
    return { ok: true, data: r };
  } catch (e) { return fail(e); }
};

const SCHEDULES = [null, 15, 60, 360, 1440];

/** Creates the connection, or (with connectionId) updates it. Returns the connection id. */
export const saveDatabaseConnection = async (input: {
  connectionId?: string; name: string; target: DbTarget; tables: ReadonlyArray<TableMapping>; everyMinutes: number | null;
}): Promise<Outcome<{ id: string }>> => {
  try {
    const me = await requireOwner();
    const name = input.name.trim().slice(0, 80);
    if (!name) return { ok: false, error: "Đặt tên cho kết nối." };
    if (!ENGINES.includes(input.target.engine)) return { ok: false, error: "Loại cơ sở dữ liệu không hợp lệ." };
    if (!SCHEDULES.includes(input.everyMinutes)) return { ok: false, error: "Chu kỳ đồng bộ không hợp lệ." };
    const target = await resolveTarget(me.workspaceId, input.connectionId, input.target);
    if (!target.password) return { ok: false, error: "Nhập mật khẩu của người dùng này." };
    const config = cleanConfig({ tables: input.tables });
    const credential = JSON.stringify({ engine: target.engine, host: target.host, port: target.port, database: target.database, user: target.user, password: target.password, ssl: target.ssl });
    // Cursors are dropped on every save: the mapping may have changed, so the next sync reads from the start again.
    const meta = { config: JSON.stringify(config), summary: summaryOf(target.engine, config.tables.length), host: target.host };
    const db = supabaseAdmin();
    if (!input.connectionId) {
      const id = await createDataConnection({ workspaceId: me.workspaceId, userId: me.userId, provider: "database", name, meta, credential, syncEveryMinutes: input.everyMinutes });
      revalidatePath("/connections");
      return { ok: true, data: { id } };
    }
    await ownDatabase(me.workspaceId, input.connectionId);
    await saveDataCredential(input.connectionId, credential);
    const { error } = await db.from("connections").update({
      name, public_meta: meta, sync_every_minutes: input.everyMinutes, next_sync_at: input.everyMinutes ? new Date().toISOString() : null, status: "connected", last_error: null,
    }).eq("id", input.connectionId).eq("workspace_id", me.workspaceId);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/connections");
    return { ok: true, data: { id: input.connectionId } };
  } catch (e) { return fail(e instanceof Error && e.cause ? asPlainError(e) : e); }
};

/** Reopens a saved connection for editing. The password is not returned, only whether one is stored. */
export const loadDatabaseConnection = async (connectionId: string): Promise<Outcome<SavedDatabase>> => {
  try {
    const me = await requireOwner();
    const c = await ownDatabase(me.workspaceId, connectionId);
    const s = await storedTarget(me.workspaceId, connectionId);
    if (!s) return { ok: false, error: "Thông tin kết nối đã lưu bị hỏng; hãy nhập lại." };
    let tables: ReadonlyArray<TableMapping> = [];
    try { tables = cleanConfig(JSON.parse(c.public_meta?.config ?? "{}")).tables; } catch { tables = []; }
    const { data: grants } = await supabaseAdmin().from("agent_connections").select("agent_id").eq("workspace_id", me.workspaceId).eq("connection_id", connectionId).in("purpose", ["data_source", "tool"]);
    const { password: _password, ...target } = s.target;
    void _password;
    return { ok: true, data: { name: c.name, target, hasPassword: true, tables, everyMinutes: c.sync_every_minutes, agentIds: ((grants ?? []) as Array<{ agent_id: string }>).map((g) => g.agent_id) } };
  } catch (e) { return fail(e); }
};
