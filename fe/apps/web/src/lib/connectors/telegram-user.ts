import "server-only";
import { Api, TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { LogLevel } from "telegram/extensions/Logger";
import { supabaseAdmin } from "../supabase/admin";
import { loadDataCredential, saveDataCredential, type Connector, type RecordInput } from "../data-hub";
import {
  MAX_PER_CHAT_PER_RUN, REVOKED_MESSAGE, cursorKey, isRevokedError, mapMessage, parseConfig, parseCredential, readCursor, sinceUnix,
  type ChatChoice, type PickedChat,
} from "@/features/connections/wizard/data/tguser/shared";

/**
 * Personal Telegram (MTProto user session), READ ONLY, only the chats the owner picked. This file calls GramJS methods that read
 * (connect, getDialogs, getMessages, auth.LogOut on disconnect) and nothing else: no send, no mark read, no join, no edit.
 * Codes, passwords and sessions are never logged.
 */

export const NOT_CONFIGURED_MESSAGE = "NIVO chưa được cấu hình để đăng nhập Telegram cá nhân (thiếu TELEGRAM_API_ID và TELEGRAM_API_HASH).";

export const telegramUserConfigured = (): boolean => {
  const id = Number(process.env.TELEGRAM_API_ID);
  return Number.isInteger(id) && id > 0 && Boolean(process.env.TELEGRAM_API_HASH?.trim());
};

export const apiCredentials = (): { apiId: number; apiHash: string } => {
  if (!telegramUserConfigured()) throw new Error(NOT_CONFIGURED_MESSAGE);
  return { apiId: Number(process.env.TELEGRAM_API_ID), apiHash: (process.env.TELEGRAM_API_HASH as string).trim() };
};

/** A client on a StringSession ("" for a brand new login). The caller must `closeClient` it. */
export const openClient = (session: string): TelegramClient => {
  const { apiId, apiHash } = apiCredentials();
  const client = new TelegramClient(new StringSession(session), apiId, apiHash, { connectionRetries: 2, deviceModel: "NIVO", appVersion: "1.0" });
  client.setLogLevel(LogLevel.NONE);
  return client;
};

export const closeClient = async (client: TelegramClient): Promise<void> => {
  try { await client.destroy(); } catch { /* already closed */ }
};

const kindOf = (d: { isUser?: boolean; isGroup?: boolean }): PickedChat["kind"] => (d.isUser ? "user" : d.isGroup ? "group" : "channel");

/** Recent dialogs for the picker (read only). */
export const listDialogs = async (session: string, limit = 100): Promise<Array<ChatChoice>> => {
  const client = openClient(session);
  try {
    await client.connect();
    const out: Array<ChatChoice> = [];
    for await (const d of client.iterDialogs({ limit })) {
      if (!d.id) continue;
      out.push({ id: d.id.toString(), title: (d.title || d.name || d.id.toString()).slice(0, 120), kind: kindOf(d), unread: d.unreadCount ?? 0 });
    }
    return out;
  } catch (e) {
    if (isRevokedError(e)) throw new Error(REVOKED_MESSAGE);
    throw e;
  } finally {
    await closeClient(client);
  }
};

/** Ends the Telegram session when possible and blanks the stored credential. Call it only after an owner check (it trusts `connectionId`). */
export const forgetTelegramUserSession = async (connectionId: string, workspaceId?: string): Promise<void> => {
  const db = supabaseAdmin();
  let q = db.from("connections").select("id, workspace_id, provider").eq("id", connectionId);
  if (workspaceId) q = q.eq("workspace_id", workspaceId);
  const { data: conn } = await q.maybeSingle<{ id: string; workspace_id: string; provider: string }>();
  if (!conn || conn.provider !== "telegram_user") return;
  try {
    const cred = parseCredential(await loadDataCredential(conn.workspace_id, conn.id));
    for (const session of [cred.session, cred.login?.session]) {
      if (!session || !telegramUserConfigured()) continue;
      const client = openClient(session);
      try {
        await client.connect();
        await client.invoke(new Api.auth.LogOut());
      } catch {
        /* already gone, or offline: the stored copy is blanked below either way */
      } finally {
        await closeClient(client);
      }
    }
  } finally {
    await saveDataCredential(conn.id, "{}");
  }
};

const nameOfSender = (s: unknown): string => {
  const x = s as { firstName?: string; lastName?: string; title?: string; username?: string } | undefined;
  if (!x) return "";
  return [x.firstName, x.lastName].filter(Boolean).join(" ") || x.title || x.username || "";
};

export const connector: Connector = {
  sync: async (ctx) => {
    const cred = parseCredential(ctx.credential);
    if (!cred.session) throw new Error(REVOKED_MESSAGE);
    const cfg = parseConfig(ctx.connection.meta.config);
    if (!cfg || cfg.chats.length === 0) return { rows: 0, note: "Chưa chọn cuộc trò chuyện nào." };
    const wanted = new Map(cfg.chats.map((c) => [c.id, c]));
    const since = sinceUnix(cfg.sinceDays);
    const client = openClient(cred.session);
    const cursors: Record<string, string> = {};
    let rows = 0;
    let capped = 0;
    try {
      await client.connect();
      if (!(await client.checkAuthorization())) throw new Error(REVOKED_MESSAGE);
      // Dialogs fill GramJS's entity cache (access hashes), which a fresh StringSession does not carry.
      const entities = new Map<string, unknown>();
      for await (const d of client.iterDialogs({ limit: 1000 })) {
        if (ctx.signal.aborted) break;
        const id = d.id?.toString();
        if (id && wanted.has(id)) {
          entities.set(id, d.entity);
          if (entities.size === wanted.size) break;
        }
      }
      for (const chat of cfg.chats) {
        if (ctx.signal.aborted) break;
        const entity = entities.get(chat.id);
        if (!entity) continue;
        const cursor = readCursor(ctx.connection.meta, chat.id);
        const msgs = await client.getMessages(entity as never, cursor > 0
          ? { reverse: true, offsetId: cursor, limit: MAX_PER_CHAT_PER_RUN }
          : { reverse: true, offsetDate: since, limit: MAX_PER_CHAT_PER_RUN });
        const records: Array<RecordInput> = [];
        let maxId = cursor;
        for (const m of msgs) {
          if (m.id > maxId) maxId = m.id;
          if (m.className !== "Message") continue; // service messages ("X joined") are skipped but move the cursor
          const hasMedia = Boolean(m.media) && m.media?.className !== "MessageMediaEmpty";
          const text = m.message ?? "";
          if (!text && !hasMedia) continue;
          records.push(mapMessage(chat, {
            id: m.id, date: m.date, text, senderName: m.out ? "Tôi" : nameOfSender(m.sender), replyToId: m.replyToMsgId ?? null, hasMedia,
          }));
        }
        if (records.length) rows += await ctx.upsert("message", records);
        if (maxId > cursor) cursors[cursorKey(chat.id)] = String(maxId);
        if (msgs.length >= MAX_PER_CHAT_PER_RUN) capped++;
      }
    } catch (e) {
      if (isRevokedError(e)) throw new Error(REVOKED_MESSAGE);
      throw e;
    } finally {
      await closeClient(client);
    }
    return {
      rows,
      ...(capped ? { note: `${capped} cuộc trò chuyện còn tin cũ hơn chưa lấy, sẽ lấy tiếp ở lần sau.` } : {}),
      ...(Object.keys(cursors).length ? { meta: cursors } : {}),
    };
  },
};
