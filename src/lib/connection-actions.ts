"use server";

import { revalidatePath } from "next/cache";
import { getT } from "@/i18n/server";
import type { Translate } from "@/i18n/core";
import { connections as dict } from "@/i18n/dict/connections";
import {
  decryptSecret, encryptSecret, getConnection, publicSiteUrl, randomSecret, sha256, webhookUrlFor,
  type Connection, type Environment, type Provider, type Purpose,
} from "./channels";
import { PROVIDERS } from "./connection-providers";
import { bankName } from "./vn-banks";
import { requireManager } from "./permissions";
import { supabaseAdmin } from "./supabase/admin";
import { tgCall } from "./telegram-api";
import { getAccessToken, loadZalo, saveZaloSecret, zaloCallbackUrl, type ZaloSecret } from "./zalo";
import { authorizeUrl as zaloAuthorizeUrlFor, newVerifier } from "./zalo-api";
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
  opts: { status?: "pending" | "connected"; environment?: Environment } = {},
): Promise<string> => {
  const db = supabaseAdmin();
  const { data: row, error } = await db.from("connections").insert({
    workspace_id: ws, provider, name, status: opts.status ?? "connected", environment: opts.environment ?? "live", created_by: userId, public_meta: meta,
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

/* ------------------------------------------------------------------ Bank / payment feeds (SePay, payOS, Casso) */

export type MoneyProvider = "sepay" | "payos" | "casso";
export type WizardConnection = {
  id: string; provider: Provider; name: string; environment: Environment; status: Connection["status"];
  webhookUrl: string; apiKey: string; bank: string; account: string; credentialsSaved: boolean;
  firstEvent: Connection["firstEvent"]; agentIds: ReadonlyArray<string>;
};

const isMoney = (p: string): p is MoneyProvider => p === "sepay" || p === "payos" || p === "casso";

const wizardView = async (ws: string, id: string, apiKey = ""): Promise<WizardConnection | null> => {
  const c = await getConnection(ws, id);
  if (!c) return null;
  return {
    id: c.id, provider: c.provider, name: c.name, environment: c.environment, status: c.status,
    webhookUrl: webhookUrlFor(c.provider, c.id), apiKey, bank: bankName(c.meta.bank_code ?? ""), account: c.meta.account_masked ?? "",
    credentialsSaved: false, firstEvent: c.firstEvent, agentIds: c.agentIds,
  };
};

/**
 * Wizard step 2: create the connection as PENDING so its webhook URL (and, for SePay, a freshly generated API key) exist for the
 * "follow along on the provider" step. SePay: the key hash verifies calls and the key itself is encrypted for re-display.
 * payOS and Casso: the provider issues the keys; they are pasted in later (saveProviderKeys), so the secret starts empty.
 */
export const startMoneyConnection = async (input: { provider: MoneyProvider; environment: Environment; name: string; bankCode: string; accountNumber: string; holder: string }): Promise<Outcome<WizardConnection>> =>
  run(async (tr) => {
    const member = await requireManager();
    if (!isMoney(input.provider)) throw userError(tr("errGeneric"));
    const def = PROVIDERS[input.provider];
    const environment: Environment = def.environments.includes(input.environment) ? input.environment : "live";
    const name = requireName(input.name, tr);
    const meta: Record<string, string> = {};
    if (def.needsBank) {
      const account = input.accountNumber.replace(/\s+/g, "");
      if (!/^\d{6,20}$/.test(account)) throw userError(tr("errAccount"));
      const bankCode = clean(input.bankCode, 20).toUpperCase();
      const holder = clean(input.holder, 80).toUpperCase();
      if (!bankCode || !holder) throw userError(tr("errBankFields"));
      Object.assign(meta, { bank_code: bankCode, account_masked: `•••• ${account.slice(-4)}`, account_holder: holder });
    }
    const apiKey = input.provider === "sepay" ? `nivo_${randomSecret()}` : "";
    const id = await createConnection(
      member.workspaceId, member.userId, input.provider, name, meta,
      encryptSecret(apiKey || "{}"), apiKey ? sha256(apiKey) : randomSecret(), { status: "pending", environment },
    );
    refresh();
    return (await wizardView(member.workspaceId, id, apiKey)) as WizardConnection;
  });

/** Continue an unfinished connection: the same data the wizard had (SePay shows its key again; payOS/Casso keys are never returned). */
export const resumeConnection = async (connectionId: string): Promise<Outcome<WizardConnection>> =>
  run(async (tr) => {
    const member = await requireManager();
    const c = await own(member.workspaceId, connectionId, tr);
    const sec = await secretOf(c.id);
    let apiKey = "";
    let saved = false;
    if (sec) {
      const plain = decryptSecret(sec.ciphertext);
      if (c.provider === "sepay") apiKey = plain;
      else saved = plain !== "{}";
    }
    return { ...((await wizardView(member.workspaceId, c.id, apiKey)) as WizardConnection), credentialsSaved: saved };
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

/**
 * payOS / Casso: store the keys the owner copied from the provider (encrypted). payOS is then asked to confirm the webhook URL itself
 * (POST /confirm-webhook with the Client ID and API Key); that call needs a public https address, so on a local site it is skipped.
 */
export const saveProviderKeys = async (connectionId: string, values: Readonly<Record<string, string>>): Promise<Outcome<{ confirmed: boolean; localOnly: boolean }>> =>
  run(async (tr) => {
    const member = await requireManager();
    const c = await own(member.workspaceId, connectionId, tr);
    const def = PROVIDERS[c.provider];
    if (!def.credentials.length) throw userError(tr("errNone"));
    const stored: Record<string, string> = {};
    for (const field of def.credentials) {
      const v = (values[field] ?? "").trim();
      if (v.length < 8 || v.length > 200) throw userError(tr("errKeys"));
      stored[field] = v;
    }
    const { error } = await supabaseAdmin().from("connection_secrets").update({ ciphertext: encryptSecret(JSON.stringify(stored)) }).eq("connection_id", c.id);
    if (error) throw new Error(error.message);
    let confirmed = false;
    const origin = publicSiteUrl();
    if (c.provider === "payos" && origin) {
      const res = await fetch("https://api-merchant.payos.vn/confirm-webhook", {
        method: "POST",
        headers: { "content-type": "application/json", "x-client-id": stored.clientId, "x-api-key": stored.apiKey },
        body: JSON.stringify({ webhookUrl: webhookUrlFor("payos", c.id, origin) }),
      }).catch(() => null);
      const json = (await res?.json().catch(() => null)) as { code?: string; desc?: string } | null;
      if (!res || json?.code !== "00") {
        console.error("payos confirm-webhook failed", res?.status, json?.code, json?.desc);
        throw userError(tr("errPayosConfirm"));
      }
      confirmed = true;
    }
    refresh();
    return { confirmed, localOnly: origin === null };
  });

export type FirstEventState = { status: Connection["status"]; firstEvent: Connection["firstEvent"] };

/** The wizard asks every 3 seconds: has the first webhook arrived for this connection? */
export const checkFirstEvent = async (connectionId: string): Promise<Outcome<FirstEventState>> =>
  run(async (tr) => {
    const member = await requireManager();
    const c = await own(member.workspaceId, connectionId, tr);
    return { status: c.status, firstEvent: c.firstEvent };
  });

/** Wizard last step: exactly these agents use this connection (add the ticked ones, drop the unticked ones for this connection only). */
export const setConnectionAgents = async (connectionId: string, agentIds: ReadonlyArray<string>): Promise<Outcome<true>> =>
  run(async (tr) => {
    const member = await requireManager();
    const ws = member.workspaceId;
    const c = await own(ws, connectionId, tr);
    const db = supabaseAdmin();
    const { data: agents } = agentIds.length
      ? await db.from("agents").select("id, module").eq("workspace_id", ws).in("id", [...agentIds])
      : { data: [] as Array<{ id: string; module: string }> };
    const rows = ((agents ?? []) as Array<{ id: string; module: string }>).flatMap((a) => {
      const purpose = PURPOSE[`${a.module}:${c.provider}`];
      return purpose ? [{ agent_id: a.id, connection_id: c.id, workspace_id: ws, purpose }] : [];
    });
    const del = await db.from("agent_connections").delete().eq("connection_id", c.id);
    if (del.error) throw new Error(del.error.message);
    if (rows.length) {
      const ins = await db.from("agent_connections").insert(rows);
      if (ins.error) throw new Error(ins.error.message);
    }
    refresh();
    return true as const;
  });

/* ------------------------------------------------------------------ Zalo OA (OAuth v4, webhook, CS messages) */

export type ZaloWizardConnection = {
  id: string; name: string; status: Connection["status"]; webhookUrl: string; callbackUrl: string;
  /** The OA has been authorized (NIVO holds tokens). */
  authorized: boolean; oaSecretSaved: boolean; oaId: string; firstEvent: Connection["firstEvent"]; agentIds: ReadonlyArray<string>;
};

const zaloView = async (ws: string, id: string): Promise<ZaloWizardConnection | null> => {
  const c = await getConnection(ws, id);
  if (!c) return null;
  const loaded = await loadZalo(id);
  return {
    id: c.id, name: c.name, status: c.status, webhookUrl: webhookUrlFor("zalo_oa", c.id), callbackUrl: zaloCallbackUrl(),
    authorized: Boolean(loaded?.secret.refreshToken), oaSecretSaved: Boolean(loaded?.secret.oaSecret), oaId: c.meta.oa_id ?? "", firstEvent: c.firstEvent, agentIds: c.agentIds,
  };
};

/** Zalo wizard: keep the app's keys (encrypted) as a PENDING connection so the callback and webhook URLs exist for the Zalo Developers screens. */
export const startZaloConnection = async (input: { name: string; appId: string; appSecret: string }): Promise<Outcome<ZaloWizardConnection>> =>
  run(async (tr) => {
    const member = await requireManager();
    const name = requireName(input.name, tr);
    const appId = clean(input.appId, 40);
    const appSecret = input.appSecret.trim();
    if (!/^\d{6,30}$/.test(appId) || appSecret.length < 8) throw userError(tr("errZaloFields"));
    // The OA secret key is copied later, from the Webhook screen; until then every webhook is refused (a blank key never verifies).
    const secret: ZaloSecret = { appId, appSecret, oaSecret: "" };
    const id = await createConnection(member.workspaceId, member.userId, "zalo_oa", name, { app_id: appId }, encryptSecret(JSON.stringify(secret)), randomSecret(), { status: "pending" });
    refresh();
    return (await zaloView(member.workspaceId, id)) as ZaloWizardConnection;
  });

/** The "OA Secret Key" from the Zalo app's Webhook screen: it signs every webhook, so it is what lets NIVO trust the events. */
export const saveZaloOaSecret = async (connectionId: string, oaSecret: string): Promise<Outcome<true>> =>
  run(async (tr) => {
    const member = await requireManager();
    const c = await own(member.workspaceId, connectionId, tr, "zalo_oa");
    const key = oaSecret.trim();
    if (key.length < 8 || key.length > 200) throw userError(tr("errKeys"));
    const loaded = await loadZalo(c.id);
    if (!loaded) throw userError(tr("errNone"));
    await saveZaloSecret(c.id, { ...loaded.secret, oaSecret: key });
    refresh();
    return true as const;
  });

/** Continue an unfinished (or broken) Zalo connection. Keys are never returned. */
export const resumeZalo = async (connectionId: string): Promise<Outcome<ZaloWizardConnection>> =>
  run(async (tr) => {
    const member = await requireManager();
    const c = await own(member.workspaceId, connectionId, tr, "zalo_oa");
    return (await zaloView(member.workspaceId, c.id)) as ZaloWizardConnection;
  });

/** "Kết nối Zalo OA": a fresh PKCE verifier + one-time state are stored with the credential, and the Zalo permission URL is returned. */
export const zaloAuthorizeUrl = async (connectionId: string): Promise<Outcome<{ url: string }>> =>
  run(async (tr) => {
    const member = await requireManager();
    const c = await own(member.workspaceId, connectionId, tr, "zalo_oa");
    const loaded = await loadZalo(c.id);
    if (!loaded) throw userError(tr("errNone"));
    const verifier = newVerifier();
    const nonce = randomSecret().slice(0, 32);
    await saveZaloSecret(c.id, { ...loaded.secret, pkce: { verifier, nonce, exp: Date.now() + 15 * 60_000 } });
    return { url: zaloAuthorizeUrlFor(loaded.secret.appId, zaloCallbackUrl(), verifier, `${c.id}.${nonce}`) };
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
    if (c.provider === "zalo_oa") {
      // The tokens are the thing that can silently die: use (and, when due, refresh) them now.
      try {
        await getAccessToken(c.id);
        await supabaseAdmin().from("connections").update({ ...(c.status === "error" ? { status: "connected" } : {}), last_error: null, updated_at: now() }).eq("id", c.id);
        refresh();
        return { provider: c.provider, webhookOk: true, localOnly: origin === null, pending: 0, lastError: null };
      } catch (e) {
        console.error("zalo check failed", e instanceof Error ? e.message : e);
        throw userError(tr("errZaloToken"));
      }
    }
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
  "chatbot:telegram": "inbound_chat", "chatbot:zalo_oa": "inbound_chat", "sales:telegram": "outbound_chat",
  "accounting:sepay": "bank_feed", "accounting:payos": "bank_feed", "accounting:casso": "bank_feed",
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
