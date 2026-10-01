"use server";

import { revalidatePath } from "next/cache";
import { getT } from "@/i18n/server";
import type { Translate } from "@/i18n/core";
import { connections as dict } from "@/i18n/dict/connections";
import {
  decryptSecret, encryptSecret, getConnection, publicSiteUrl, randomSecret, sha256, webhookUrlFor,
  type Connection, type Provider, type Purpose,
} from "./channels";
import { requireManager } from "./permissions";
import { supabaseAdmin } from "./supabase/admin";
import { tgCall } from "./telegram-api";
import type { Outcome } from "./types";

/**
 * Create, check, disconnect and bind the workspace connections (Telegram bots, SePay bank feeds, Zalo OA config).
 * Every action first requires owner|manager, is scoped to the caller workspace and uses the service role (the tables have no
 * client write policy). Credentials are validated, encrypted (AES-256-GCM) and never returned to the browser; the one exception
 * is the SePay API key, which the manager must paste into SePay and can show again with revealSepayKey.
 */
type Tr = Translate<(typeof dict)["en"]>;

class UserError extends Error {}
const userError = (message: string) => new UserError(message);

/** A Telegram or network failure in plain words (the technical text stays in the server log). */
const friendly = (e: unknown, tr: Tr): string => {
  if (e instanceof UserError) return e.message;
  const raw = e instanceof Error ? e.message : String(e);
  if (/unauthorized|not found|404|401/i.test(raw)) return tr("errToken");
  if (/fetch failed|network|timeout|ENOTFOUND|ECONN/i.test(raw)) return tr("errNetwork");
  console.error("connection error", raw);
  return tr("errGeneric");
};

const run = async <T>(fn: (tr: Tr) => Promise<T>): Promise<Outcome<T>> => {
  const tr = await getT(dict);
  try {
    return { ok: true, data: await fn(tr) };
  } catch (e) {
    return { ok: false, error: friendly(e, tr) };
  }
};

const now = () => new Date().toISOString();
const refresh = () => revalidatePath("/", "layout");
const clean = (v: string, max = 120) => v.trim().slice(0, max);

const requireName = (name: string, tr: Tr): string => {
  const n = clean(name, 60);
  if (n.length < 2) throw userError(tr("errName"));
  return n;
};

/** The caller own connection (optionally of one provider), or a friendly error. */
const own = async (workspaceId: string, id: string, tr: Tr, provider?: Provider): Promise<Connection> => {
  const c = await getConnection(workspaceId, id);
  if (!c || (provider && c.provider !== provider)) throw userError(tr("errNone"));
  return c;
};

const secretOf = async (connectionId: string): Promise<{ ciphertext: string; webhook_secret: string } | null> => {
  const { data } = await supabaseAdmin().from("connection_secrets").select("ciphertext, webhook_secret").eq("connection_id", connectionId).maybeSingle();
  return (data as { ciphertext: string; webhook_secret: string } | null) ?? null;
};

/** Insert the connection row, then its secret; undo the row when the secret cannot be stored. */
const createConnection = async (
  ws: string, userId: string, provider: Provider, name: string, meta: Record<string, string>, ciphertext: string, webhookSecret: string,
): Promise<string> => {
  const db = supabaseAdmin();
  const { data: row, error } = await db.from("connections").insert({
    workspace_id: ws, provider, name, status: "connected", created_by: userId, public_meta: meta,
  }).select("id").single();
  if (error || !row) throw new Error(error?.message ?? "connection not saved");
  const id = row.id as string;
  const saved = await db.from("connection_secrets").insert({ connection_id: id, ciphertext, webhook_secret: webhookSecret });
  if (saved.error) {
    await db.from("connections").delete().eq("id", id);
    throw new Error(saved.error.message);
  }
  return id;
};

/* ------------------------------------------------------------------ Telegram */

export type TelegramConnected = { connection: Connection; webhookRegistered: boolean };

/** Validate the token with getMe, store it encrypted, then point the bot webhook at this connection own URL. */
export const connectTelegram = async (input: { name: string; token: string }): Promise<Outcome<TelegramConnected>> =>
  run(async (tr) => {
    const member = await requireManager();
    const ws = member.workspaceId;
    const name = requireName(input.name, tr);
    const token = input.token.trim();
    if (!/^\d{5,}:[A-Za-z0-9_-]{30,}$/.test(token)) throw userError(tr("errFormat"));
    const me = await tgCall<{ id: number; username?: string }>(token, "getMe");
    const botId = String(me.id);
    const db = supabaseAdmin();

    // One bot has one webhook: refuse a bot that is already live in a connection instead of silently stealing its customers.
    const { data: taken } = await db.from("connections").select("id").eq("provider", "telegram").eq("public_meta->>bot_id", botId).neq("status", "disconnected").limit(1);
    if (taken?.length) throw userError(tr("errInUse"));

    const secret = randomSecret();
    const id = await createConnection(ws, member.userId, "telegram", name, { bot_id: botId, bot_username: me.username ?? "" }, encryptSecret(token), secret);

    // setWebhook only works on a public https address; on localhost the connection is stored and registered later on the real domain.
    const origin = publicSiteUrl();
    let webhookRegistered = false;
    if (origin) {
      try {
        await tgCall(token, "setWebhook", { url: webhookUrlFor("telegram", id, origin), secret_token: secret, allowed_updates: ["message"] });
        webhookRegistered = true;
      } catch (e) {
        const message = `${tr("errWebhook")} ${friendly(e, tr)}`;
        await db.from("connections").update({ status: "error", last_error: message, updated_at: now() }).eq("id", id);
        refresh();
        throw userError(message);
      }
    }
    refresh();
    return { connection: (await getConnection(ws, id)) as Connection, webhookRegistered };
  });

/* ------------------------------------------------------------------ SePay (the workspace own bank feed) */

export type SepayConnected = { connection: Connection; apiKey: string; webhookUrl: string };

/** Store the account facts and a freshly generated API key (its hash verifies calls; the key itself is encrypted for re-display). */
export const connectSepay = async (input: { name: string; accountNumber: string; bankCode: string; holder: string }): Promise<Outcome<SepayConnected>> =>
  run(async (tr) => {
    const member = await requireManager();
    const name = requireName(input.name, tr);
    const account = input.accountNumber.replace(/\s+/g, "");
    if (!/^\d{6,20}$/.test(account)) throw userError(tr("errAccount"));
    const bankCode = clean(input.bankCode, 20).toUpperCase();
    const holder = clean(input.holder, 80).toUpperCase();
    if (!bankCode || !holder) throw userError(tr("errBankFields"));
    const apiKey = `nivo_${randomSecret()}`;
    const id = await createConnection(
      member.workspaceId, member.userId, "sepay", name,
      { bank_code: bankCode, account_masked: `•••• ${account.slice(-4)}`, account_holder: holder }, encryptSecret(apiKey), sha256(apiKey),
    );
    refresh();
    return { connection: (await getConnection(member.workspaceId, id)) as Connection, apiKey, webhookUrl: webhookUrlFor("sepay", id) };
  });

/** Show the SePay API key again (owner or manager only) so it can be pasted into SePay webhook settings. */
export const revealSepayKey = async (connectionId: string): Promise<Outcome<{ apiKey: string; webhookUrl: string }>> =>
  run(async (tr) => {
    const member = await requireManager();
    await own(member.workspaceId, connectionId, tr, "sepay");
    const sec = await secretOf(connectionId);
    if (!sec) throw userError(tr("errNone"));
    return { apiKey: decryptSecret(sec.ciphertext), webhookUrl: webhookUrlFor("sepay", connectionId) };
  });

/* ------------------------------------------------------------------ Zalo OA (configuration only for now) */

/** Zalo OA: the configuration is stored (secrets encrypted) but nothing is sent or received yet. */
export const connectZalo = async (input: { name: string; oaId: string; appId: string; appSecret: string; accessToken: string; refreshToken: string }): Promise<Outcome<Connection>> =>
  run(async (tr) => {
    const member = await requireManager();
    const name = requireName(input.name, tr);
    const oaId = clean(input.oaId, 40);
    const appId = clean(input.appId, 40);
    if (!oaId || !appId || !input.accessToken.trim()) throw userError(tr("errZaloFields"));
    const payload = JSON.stringify({ appSecret: input.appSecret.trim(), accessToken: input.accessToken.trim(), refreshToken: input.refreshToken.trim() });
    const id = await createConnection(member.workspaceId, member.userId, "zalo_oa", name, { oa_id: oaId, app_id: appId }, encryptSecret(payload), randomSecret());
    refresh();
    return (await getConnection(member.workspaceId, id)) as Connection;
  });

/* ------------------------------------------------------------------ check, disconnect, delete */

export type ConnectionCheck = {
  provider: Provider;
  /** Telegram: Telegram knows our webhook URL. Other providers: always false (nothing to ask). */
  webhookOk: boolean;
  localOnly: boolean;
  pending: number;
  lastError: string | null;
};

/** Ask the provider what it knows (Telegram: getMe + getWebhookInfo, pending updates and the last delivery error). */
export const testConnection = async (connectionId: string): Promise<Outcome<ConnectionCheck>> =>
  run(async (tr) => {
    const member = await requireManager();
    const c = await own(member.workspaceId, connectionId, tr);
    if (c.status === "disconnected") throw userError(tr("errNone"));
    const origin = publicSiteUrl();
    if (c.provider !== "telegram") return { provider: c.provider, webhookOk: false, localOnly: origin === null, pending: 0, lastError: null };
    const sec = await secretOf(c.id);
    if (!sec) throw userError(tr("errNone"));
    const db = supabaseAdmin();
    const token = decryptSecret(sec.ciphertext);
    try {
      await tgCall(token, "getMe");
      const info = await tgCall<{ url?: string; pending_update_count?: number; last_error_message?: string }>(token, "getWebhookInfo");
      const webhookOk = origin !== null && info.url === webhookUrlFor("telegram", c.id, origin);
      const lastError = info.last_error_message ?? null;
      const status = origin === null || (webhookOk && !lastError) ? "connected" : "error";
      await db.from("connections").update({ status, last_error: origin === null ? null : lastError, updated_at: now() }).eq("id", c.id);
      refresh();
      return { provider: c.provider, webhookOk, localOnly: origin === null, pending: info.pending_update_count ?? 0, lastError };
    } catch (e) {
      const message = friendly(e, tr);
      await db.from("connections").update({ status: "error", last_error: message, updated_at: now() }).eq("id", c.id);
      refresh();
      throw userError(message);
    }
  });

/** Stop using a connection: remove the Telegram webhook, wipe the stored credential, keep the row (and its history) as disconnected. */
export const disconnectConnection = async (connectionId: string): Promise<Outcome<true>> =>
  run(async (tr) => {
    const member = await requireManager();
    const c = await own(member.workspaceId, connectionId, tr);
    const db = supabaseAdmin();
    if (c.provider === "telegram" && publicSiteUrl()) {
      const sec = await secretOf(c.id);
      if (sec) await tgCall(decryptSecret(sec.ciphertext), "deleteWebhook").catch((e) => console.error("telegram deleteWebhook failed", e instanceof Error ? e.message : e));
    }
    await db.from("connection_secrets").delete().eq("connection_id", c.id);
    const { error } = await db.from("connections").update({ status: "disconnected", last_error: null, updated_at: now() }).eq("id", c.id);
    if (error) throw new Error(error.message);
    refresh();
    return true as const;
  });

/** Remove a disconnected connection from the list (its conversations stay; bindings go with it). */
export const deleteConnection = async (connectionId: string): Promise<Outcome<true>> =>
  run(async (tr) => {
    const member = await requireManager();
    const c = await own(member.workspaceId, connectionId, tr);
    if (c.status !== "disconnected") throw userError(tr("errStillConnected"));
    const { error } = await supabaseAdmin().from("connections").delete().eq("id", c.id);
    if (error) throw new Error(error.message);
    refresh();
    return true as const;
  });

/* ------------------------------------------------------------------ which connections an agent uses */

const PURPOSE: Record<string, Purpose | undefined> = {
  "chatbot:telegram": "inbound_chat", "chatbot:zalo_oa": "inbound_chat", "sales:telegram": "outbound_chat", "accounting:sepay": "bank_feed",
};

/** Replace the set of connections one agent uses. Only connections that make sense for the agent module can be picked. */
export const setAgentConnections = async (agentId: string, connectionIds: ReadonlyArray<string>): Promise<Outcome<true>> =>
  run(async (tr) => {
    const member = await requireManager();
    const ws = member.workspaceId;
    const db = supabaseAdmin();
    const { data: agent } = await db.from("agents").select("id, module").eq("id", agentId).eq("workspace_id", ws).maybeSingle<{ id: string; module: string }>();
    if (!agent) throw userError(tr("errNone"));
    const { data: found } = connectionIds.length
      ? await db.from("connections").select("id, provider, status").eq("workspace_id", ws).in("id", [...connectionIds])
      : { data: [] as Array<{ id: string; provider: string; status: string }> };
    const known = new Map((found ?? []).map((c) => [c.id as string, c as { provider: string; status: string }]));
    const rows = connectionIds.flatMap((id) => {
      const c = known.get(id);
      const purpose = c ? PURPOSE[`${agent.module}:${c.provider}`] : undefined;
      return c && c.status !== "disconnected" && purpose ? [{ agent_id: agent.id, connection_id: id, workspace_id: ws, purpose }] : [];
    });
    const del = await db.from("agent_connections").delete().eq("agent_id", agent.id);
    if (del.error) throw new Error(del.error.message);
    if (rows.length) {
      const ins = await db.from("agent_connections").insert(rows);
      if (ins.error) throw new Error(ins.error.message);
    }
    refresh();
    return true as const;
  });
