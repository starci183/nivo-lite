"use server";

import { revalidatePath } from "next/cache";
import { Api } from "telegram";
import { computeCheck } from "telegram/Password";
import { requireOwner } from "../permissions";
import { createDataConnection, loadDataCredential, saveDataCredential } from "../data-hub";
import { supabaseAdmin } from "../supabase/admin";
import type { Outcome } from "../types";
import {
  MAX_CHATS, REVOKED_MESSAGE, SCHEDULE_CHOICES, accountLabel, errorCode, isRevokedError, loginExpired, normalizePhone, parseConfig, parseCredential,
  serializeConfig, summaryOf, type ChatChoice, type LoginStage, type PickedChat, type SinceDays, type TgConfig, type TgCredential,
} from "@/features/connections/wizard/data/tguser/shared";
import { NOT_CONFIGURED_MESSAGE, apiCredentials, closeClient, listDialogs, openClient, telegramUserConfigured } from "./telegram-user";

/**
 * Server actions of the personal Telegram wizard. Every one starts with requireOwner() and is scoped by the owner's workspace.
 * The login state (phoneCodeHash, temporary session) and the final session live ONLY in the encrypted connection credential;
 * nothing secret is ever returned to the browser.
 */

type Own = { readonly id: string; readonly workspaceId: string; readonly name: string; readonly status: string; readonly meta: Record<string, string>; readonly everyMinutes: number | null };

const own = async (workspaceId: string, connectionId: string): Promise<Own> => {
  const { data } = await supabaseAdmin().from("connections").select("id, workspace_id, name, status, provider, public_meta, sync_every_minutes")
    .eq("id", connectionId).eq("workspace_id", workspaceId).eq("provider", "telegram_user").maybeSingle<{
      id: string; workspace_id: string; name: string; status: string; public_meta: Record<string, string> | null; sync_every_minutes: number | null;
    }>();
  if (!data || data.status === "disconnected") throw plain("Không tìm thấy kết nối Telegram này.");
  return { id: data.id, workspaceId: data.workspace_id, name: data.name, status: data.status, meta: data.public_meta ?? {}, everyMinutes: data.sync_every_minutes };
};

const readCred = async (c: Own): Promise<TgCredential> => parseCredential(await loadDataCredential(c.workspaceId, c.id));
const writeCred = (id: string, cred: TgCredential) => saveDataCredential(id, JSON.stringify(cred));

/** Our own errors carry plain Vietnamese and are shown as is; everything else goes through explain(). */
class PlainError extends Error {}
const plain = (m: string) => new PlainError(m);

/** Plain Vietnamese for what Telegram says. Unknown errors never echo internals. */
const explain = (e: unknown): string => {
  const code = errorCode(e);
  if (/^PHONE_CODE_INVALID|^PHONE_CODE_EMPTY/.test(code)) return "Mã không đúng, hãy kiểm tra lại.";
  if (/^PHONE_CODE_EXPIRED/.test(code)) return "Mã đã hết hạn, hãy gửi lại mã.";
  if (/^PASSWORD_HASH_INVALID/.test(code)) return "Mật khẩu hai bước không đúng.";
  if (/^PHONE_NUMBER_INVALID/.test(code)) return "Số điện thoại không hợp lệ.";
  if (/^PHONE_NUMBER_BANNED/.test(code)) return "Telegram không cho số này đăng nhập.";
  if (/^PHONE_NUMBER_FLOOD|^FLOOD|^SEND_CODE_UNAVAILABLE/.test(code)) return "Telegram đang giới hạn số lần gửi mã, hãy thử lại sau ít phút.";
  if (isRevokedError(e)) return REVOKED_MESSAGE;
  if (e instanceof Error && e.message === REVOKED_MESSAGE) return REVOKED_MESSAGE;
  return "Không nói chuyện được với Telegram lúc này, hãy thử lại sau.";
};

const guard = async <T>(fn: (workspaceId: string, userId: string) => Promise<T>): Promise<Outcome<T>> => {
  let member;
  try {
    member = await requireOwner();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  try {
    return { ok: true, data: await fn(member.workspaceId, member.userId) };
  } catch (e) {
    return { ok: false, error: e instanceof PlainError ? e.message : explain(e) };
  }
};

/* ------------------------------------------------------------------ status */

export type SetupState = {
  readonly name: string;
  readonly status: "pending" | "connected" | "error";
  readonly stage: LoginStage | "ready";
  readonly config: TgConfig | null;
  readonly everyMinutes: number | null;
  readonly consent: boolean;
};

/** Whether the app's Telegram API credentials are set on this server. */
export const telegramUserReady = async (): Promise<Outcome<{ configured: boolean }>> =>
  guard(async () => ({ configured: telegramUserConfigured() }));

/** Where to continue a pending login or edit the picks of a connected account. */
export const loadTelegramUserSetup = async (connectionId: string): Promise<Outcome<SetupState>> =>
  guard(async (ws) => {
    const c = await own(ws, connectionId);
    const cred = await readCred(c);
    const pending = c.status === "pending";
    if (pending && (!cred.login || loginExpired(cred.login))) throw plain("Phiên đăng nhập đã hết hạn, hãy bắt đầu lại.");
    const state: SetupState = {
      name: c.name, status: pending ? "pending" : c.status === "error" ? "error" : "connected",
      stage: pending && cred.login ? cred.login.stage : "ready", config: parseConfig(c.meta.config), everyMinutes: c.everyMinutes, consent: Boolean(c.meta.consentAt),
    };
    return state;
  });

/* ------------------------------------------------------------------ login */

/** Sends the login code. Creates the pending connection on the first call; `connectionId` re-uses it (a corrected number). */
export const startTelegramLogin = async (input: { name: string; phone: string; consent: boolean; connectionId?: string }): Promise<Outcome<{ connectionId: string; viaApp: boolean }>> =>
  guard(async (ws, userId) => {
    if (!telegramUserConfigured()) throw plain(NOT_CONFIGURED_MESSAGE);
    if (!input.consent) throw plain("Hãy đọc và đồng ý với phần cam kết trước khi đăng nhập.");
    const name = input.name.trim().slice(0, 80);
    if (!name) throw plain("Hãy đặt tên cho kết nối.");
    const phone = normalizePhone(input.phone);
    if (!phone) throw plain("Số điện thoại không hợp lệ. Nhập số có mã quốc gia, ví dụ +84912345678.");
    const existing = input.connectionId ? await own(ws, input.connectionId) : null;
    if (existing && existing.status !== "pending") throw plain("Kết nối này đã đăng nhập.");

    const client = openClient("");
    let login;
    let viaApp = true;
    try {
      await client.connect();
      const sent = await client.sendCode(apiCredentials(), phone);
      viaApp = sent.isCodeViaApp;
      login = { stage: "code" as const, phone, phoneCodeHash: sent.phoneCodeHash, session: String(client.session.save()), startedAt: Date.now() };
    } finally {
      await closeClient(client);
    }
    const meta = { consentAt: new Date().toISOString() };
    if (existing) {
      await writeCred(existing.id, { login });
      await supabaseAdmin().from("connections").update({ name, public_meta: { ...existing.meta, ...meta } }).eq("id", existing.id).eq("workspace_id", ws);
      return { connectionId: existing.id, viaApp };
    }
    const id = await createDataConnection({ workspaceId: ws, userId, provider: "telegram_user", name, meta, credential: JSON.stringify({ login }), syncEveryMinutes: null, status: "pending" });
    return { connectionId: id, viaApp };
  });

const pendingLogin = async (ws: string, connectionId: string) => {
  const c = await own(ws, connectionId);
  const cred = await readCred(c);
  if (c.status !== "pending" || !cred.login) throw plain("Không có lần đăng nhập nào đang chờ mã.");
  if (loginExpired(cred.login)) throw plain("Phiên đăng nhập đã hết hạn, hãy bắt đầu lại.");
  return { c, login: cred.login };
};

/** Asks Telegram for a fresh code (the login keeps its 10 minute life from the first code). */
export const resendTelegramCode = async (connectionId: string): Promise<Outcome<true>> =>
  guard(async (ws) => {
    const { c, login } = await pendingLogin(ws, connectionId);
    const client = openClient(login.session);
    try {
      await client.connect();
      const r = await client.invoke(new Api.auth.ResendCode({ phoneNumber: login.phone, phoneCodeHash: login.phoneCodeHash }));
      const hash = "phoneCodeHash" in r ? r.phoneCodeHash : login.phoneCodeHash;
      await writeCred(c.id, { login: { ...login, stage: "code", phoneCodeHash: hash, session: String(client.session.save()) } });
    } finally {
      await closeClient(client);
    }
    return true as const;
  });

const finishLogin = async (c: Own, client: ReturnType<typeof openClient>, phone: string): Promise<void> => {
  const me = await client.getMe();
  const display = [me.firstName, me.lastName].filter(Boolean).join(" ");
  await writeCred(c.id, { session: String(client.session.save()) });
  await supabaseAdmin().from("connections").update({ public_meta: { ...c.meta, account: accountLabel(display, me.username ?? undefined, phone) } }).eq("id", c.id).eq("workspace_id", c.workspaceId);
};

/** The code from Telegram. Returns the next stage: "password" when the account has two-step verification, otherwise "ready". */
export const submitTelegramCode = async (input: { connectionId: string; code: string }): Promise<Outcome<{ stage: LoginStage | "ready" }>> =>
  guard(async (ws) => {
    const { c, login } = await pendingLogin(ws, input.connectionId);
    const code = input.code.replace(/\D/g, "");
    if (code.length < 4 || code.length > 8) throw plain("Mã gồm 5 chữ số, hãy nhập lại.");
    const client = openClient(login.session);
    try {
      await client.connect();
      try {
        const r = await client.invoke(new Api.auth.SignIn({ phoneNumber: login.phone, phoneCodeHash: login.phoneCodeHash, phoneCode: code }));
        if (r instanceof Api.auth.AuthorizationSignUpRequired) throw plain("Số này chưa có tài khoản Telegram.");
      } catch (e) {
        if (errorCode(e) !== "SESSION_PASSWORD_NEEDED") throw e;
        await writeCred(c.id, { login: { ...login, stage: "password", session: String(client.session.save()) } });
        return { stage: "password" as const };
      }
      await finishLogin(c, client, login.phone);
      return { stage: "ready" as const };
    } finally {
      await closeClient(client);
    }
  });

/** The two-step verification (cloud) password. It is used once, to prove the login, and never stored. */
export const submitTelegramPassword = async (input: { connectionId: string; password: string }): Promise<Outcome<{ stage: "ready" }>> =>
  guard(async (ws) => {
    const { c, login } = await pendingLogin(ws, input.connectionId);
    if (login.stage !== "password") throw plain("Tài khoản này chưa cần mật khẩu hai bước.");
    if (!input.password) throw plain("Hãy nhập mật khẩu hai bước.");
    const client = openClient(login.session);
    try {
      await client.connect();
      const pwd = await client.invoke(new Api.account.GetPassword());
      await client.invoke(new Api.auth.CheckPassword({ password: await computeCheck(pwd, input.password) }));
      await finishLogin(c, client, login.phone);
      return { stage: "ready" as const };
    } finally {
      await closeClient(client);
    }
  });

/** Cancels a login in progress: drops the pending connection and its temporary session. A connected account is left alone. */
export const cancelTelegramLogin = async (connectionId: string): Promise<Outcome<true>> =>
  guard(async (ws) => {
    const c = await own(ws, connectionId);
    if (c.status !== "pending") return true as const;
    await supabaseAdmin().from("connections").delete().eq("id", c.id).eq("workspace_id", ws).eq("status", "pending");
    revalidatePath("/connections");
    return true as const;
  });

/* ------------------------------------------------------------------ chats */

/** Recent chats of the account (read only), for the picker. */
export const listTelegramChats = async (connectionId: string): Promise<Outcome<ReadonlyArray<ChatChoice>>> =>
  guard(async (ws) => {
    const c = await own(ws, connectionId);
    const cred = await readCred(c);
    if (!cred.session) throw plain(REVOKED_MESSAGE);
    return listDialogs(cred.session, 100);
  });

/** Saves the ticked chats, the first window and the schedule; the connection becomes connected. */
export const saveTelegramUserSetup = async (input: { connectionId: string; chats: ReadonlyArray<PickedChat>; sinceDays: SinceDays; everyMinutes: number | null }): Promise<Outcome<true>> =>
  guard(async (ws) => {
    const c = await own(ws, input.connectionId);
    const cred = await readCred(c);
    if (!cred.session) throw plain("Chưa đăng nhập Telegram.");
    if (!SCHEDULE_CHOICES.includes(input.everyMinutes)) throw plain("Chu kỳ đồng bộ không hợp lệ.");
    if (input.chats.length > MAX_CHATS) throw plain(`Chọn tối đa ${MAX_CHATS} cuộc trò chuyện.`);
    const cfg = parseConfig(JSON.stringify({ chats: input.chats, sinceDays: input.sinceDays }));
    if (!cfg || cfg.chats.length === 0) throw plain("Hãy chọn ít nhất một cuộc trò chuyện.");
    const { error } = await supabaseAdmin().from("connections").update({
      status: "connected", last_error: null,
      public_meta: { ...c.meta, config: serializeConfig(cfg), summary: summaryOf(cfg.chats.length) },
      sync_every_minutes: input.everyMinutes, next_sync_at: input.everyMinutes ? new Date().toISOString() : null,
    }).eq("id", c.id).eq("workspace_id", ws);
    if (error) throw plain("Không lưu được, hãy thử lại.");
    revalidatePath("/connections");
    return true as const;
  });
