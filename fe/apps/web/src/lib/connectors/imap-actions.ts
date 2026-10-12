"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "../permissions";
import { createDataConnection, loadDataCredential, saveDataCredential } from "../data-hub";
import { supabaseAdmin } from "../supabase/admin";
import type { Outcome } from "../types";
import { SINCE_CHOICES, friendlyImapError, listFolders, parseConfig, parseCredential, type ImapCredential, type ImapSecurity } from "./imap";

/** What the wizard may know about a saved mailbox: never the password. */
export type ImapView = {
  readonly id: string; readonly name: string; readonly email: string; readonly host: string; readonly port: number; readonly security: ImapSecurity;
  readonly user: string; readonly folders: ReadonlyArray<string>; readonly sinceDays: number; readonly syncEveryMinutes: number | null;
  /** Agents that hold a grant on this mailbox. */
  readonly agentIds: ReadonlyArray<string>;
};

export type ImapInput = {
  readonly connectionId?: string;
  readonly name: string; readonly email: string;
  readonly host: string; readonly port: number; readonly security: ImapSecurity; readonly user: string;
  /** Blank on an existing connection keeps the saved password. */
  readonly password: string;
  readonly folders?: ReadonlyArray<string>; readonly sinceDays?: number; readonly syncEveryMinutes?: number | null;
};

const fail = (e: unknown): { ok: false; error: string } => ({ ok: false, error: e instanceof Error ? e.message : String(e) });

const ownMailbox = async (workspaceId: string, id: string) => {
  const { data } = await supabaseAdmin().from("connections").select("id, name, provider, public_meta, sync_every_minutes").eq("id", id).eq("workspace_id", workspaceId).maybeSingle<{ id: string; name: string; provider: string; public_meta: Record<string, string> | null; sync_every_minutes: number | null }>();
  if (!data || data.provider !== "imap") throw new Error("Không tìm thấy hộp thư này.");
  return data;
};

/** The typed settings checked and turned into the credential (the saved password fills a blank one). */
const credentialOf = async (workspaceId: string, i: ImapInput): Promise<ImapCredential> => {
  const host = String(i.host ?? "").trim();
  const user = String(i.user ?? "").trim();
  if (!host || host.length > 253 || /[\s/]/.test(host)) throw new Error("Địa chỉ máy chủ không hợp lệ.");
  if (!Number.isInteger(i.port) || i.port < 1 || i.port > 65535) throw new Error("Cổng phải từ 1 đến 65535.");
  if (i.security !== "tls" && i.security !== "starttls") throw new Error("Kiểu bảo mật không hợp lệ.");
  if (!user || user.length > 320) throw new Error("Nhập tên đăng nhập của hộp thư.");
  let password = String(i.password ?? "");
  if (!password && i.connectionId) {
    const saved = await loadDataCredential(workspaceId, i.connectionId);
    if (saved) password = parseCredential(saved).password;
  }
  if (!password) throw new Error("Nhập mật khẩu ứng dụng của hộp thư.");
  return { host, port: i.port, secure: i.security === "tls", user, password };
};

/** The saved mailbox, minus the password (for editing). */
export const loadImapView = async (connectionId: string): Promise<Outcome<ImapView>> => {
  try {
    const me = await requireOwner();
    const c = await ownMailbox(me.workspaceId, connectionId);
    const raw = await loadDataCredential(me.workspaceId, connectionId);
    const cred = raw ? parseCredential(raw) : null;
    const cfg = parseConfig(c.public_meta ?? {});
    const { data: grants } = await supabaseAdmin().from("agent_connections").select("agent_id").eq("workspace_id", me.workspaceId).eq("connection_id", connectionId);
    return {
      ok: true,
      data: {
        id: c.id, name: c.name, email: c.public_meta?.email ?? "", host: cred?.host ?? "", port: cred?.port ?? 993, security: cred && !cred.secure ? "starttls" : "tls",
        user: cred?.user ?? "", folders: cfg.folders, sinceDays: cfg.sinceDays, syncEveryMinutes: c.sync_every_minutes,
        agentIds: [...new Set(((grants ?? []) as Array<{ agent_id: string }>).map((g) => g.agent_id))],
      },
    };
  } catch (e) {
    return fail(e);
  }
};

/** "Kiểm tra kết nối": logs in (read only) and lists the folders. Nothing is saved. */
export const testImapConnection = async (input: ImapInput): Promise<Outcome<{ folders: string[] }>> => {
  try {
    const me = await requireOwner();
    if (input.connectionId) await ownMailbox(me.workspaceId, input.connectionId);
    const folders = await listFolders(await credentialOf(me.workspaceId, input));
    return { ok: true, data: { folders } };
  } catch (e) {
    return { ok: false, error: friendlyImapError(e) };
  }
};

/** Creates the mailbox connection, or updates the one in `connectionId`. The credential is stored encrypted. */
export const saveImapConnection = async (input: ImapInput): Promise<Outcome<{ id: string }>> => {
  try {
    const me = await requireOwner();
    const name = String(input.name ?? "").trim();
    const email = String(input.email ?? "").trim();
    if (!name || name.length > 80) return { ok: false, error: "Nhập tên kết nối (tối đa 80 ký tự)." };
    if (email.length > 320) return { ok: false, error: "Địa chỉ email quá dài." };
    const folders = [...new Set((input.folders ?? []).map((f) => String(f)).filter((f) => f && f.length <= 200))].slice(0, 20);
    if (!folders.length) return { ok: false, error: "Chọn ít nhất một thư mục." };
    const sinceDays = input.sinceDays ?? 30;
    if (!SINCE_CHOICES.includes(sinceDays)) return { ok: false, error: "Khoảng thời gian không hợp lệ." };
    const every = input.syncEveryMinutes ?? null;
    if (every !== null && ![15, 60, 360].includes(every)) return { ok: false, error: "Chu kỳ không hợp lệ." };
    const cred = await credentialOf(me.workspaceId, input);
    const config = JSON.stringify({ folders, sinceDays });
    const summary = `${folders.length > 2 ? `${folders.slice(0, 2).join(", ")} +${folders.length - 2}` : folders.join(", ")} · ${sinceDays} ngày`;

    if (input.connectionId) {
      const c = await ownMailbox(me.workspaceId, input.connectionId);
      await saveDataCredential(c.id, JSON.stringify(cred));
      const { error } = await supabaseAdmin().from("connections").update({
        name, public_meta: { ...(c.public_meta ?? {}), config, summary, email }, sync_every_minutes: every,
        next_sync_at: every ? new Date().toISOString() : null, status: "connected", last_error: null,
      }).eq("id", c.id);
      if (error) return { ok: false, error: error.message };
      revalidatePath("/connections");
      return { ok: true, data: { id: c.id } };
    }
    const id = await createDataConnection({
      workspaceId: me.workspaceId, userId: me.userId, provider: "imap", name, meta: { config, summary, email },
      credential: JSON.stringify(cred), syncEveryMinutes: every,
    });
    revalidatePath("/connections");
    return { ok: true, data: { id } };
  } catch (e) {
    return fail(e);
  }
};
