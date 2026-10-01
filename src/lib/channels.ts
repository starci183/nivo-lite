import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "./supabase/admin";

/**
 * Per-workspace connections (Telegram bots, SePay bank feeds, Zalo OA config). Non-secret facts live in `connections` (members
 * read them under RLS); the encrypted credential and the webhook secret live in `connection_secrets` (service role only).
 * Encryption is AES-256-GCM in app code with env CHANNEL_TOKEN_KEY (32 bytes, base64). Stored form: base64(iv(12) | tag(16) | ciphertext).
 * Which agent uses which connection is `agent_connections`; a webhook only acts for a connection bound to the right active agent.
 */
export type Provider = "telegram" | "sepay" | "zalo_oa";
export type ConnectionStatus = "connected" | "error" | "disconnected";
export type Purpose = "inbound_chat" | "outbound_chat" | "bank_feed";

export type Connection = {
  readonly id: string;
  readonly workspaceId: string;
  readonly provider: Provider;
  readonly name: string;
  /** Non-secret facts: bot_username, bot_id, account_masked, bank_code, account_holder, oa_id, app_id ... */
  readonly meta: Readonly<Record<string, string>>;
  readonly status: ConnectionStatus;
  readonly lastError: string | null;
  /** Ids of the agents that use this connection. */
  readonly agentIds: ReadonlyArray<string>;
};

const key = (): Buffer => {
  const raw = process.env.CHANNEL_TOKEN_KEY;
  const buf = raw ? Buffer.from(raw, "base64") : Buffer.alloc(0);
  if (buf.length !== 32) throw new Error("CHANNEL_TOKEN_KEY must be 32 bytes, base64 (see secrets.example.env)");
  return buf;
};

export const encryptSecret = (plain: string): string => {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64");
};

export const decryptSecret = (stored: string): string => {
  const buf = Buffer.from(stored, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key(), buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString("utf8");
};

/** Constant-time string equality (different lengths are simply unequal). */
export const safeEqual = (a: string, b: string): boolean => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

export const randomSecret = (): string => randomBytes(32).toString("hex");
export const sha256 = (s: string): string => createHash("sha256").update(s).digest("hex");

/** The public https origin providers can reach, or null on localhost / plain http (setWebhook would be refused there). */
export const publicSiteUrl = (): string | null => {
  try {
    const url = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "");
    const local = url.hostname === "localhost" || url.hostname.endsWith(".localhost") || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
    return url.protocol === "https:" && !local ? url.origin : null;
  } catch {
    return null;
  }
};

/** The webhook URL a provider must call for this connection (built from NEXT_PUBLIC_SITE_URL, even on localhost, for display). */
export const webhookUrlFor = (provider: Provider, connectionId: string, origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3100"): string => {
  const base = origin.replace(/\/$/, "");
  return provider === "telegram" ? `${base}/api/telegram/${connectionId}` : `${base}/api/connections/${provider}/${connectionId}`;
};

type Row = { id: string; workspace_id: string; provider: Provider; name: string; public_meta: Record<string, string> | null; status: ConnectionStatus; last_error: string | null };
export const CONNECTION_SELECT = "id, workspace_id, provider, name, public_meta, status, last_error";
const toConnection = (r: Row, agentIds: ReadonlyArray<string>): Connection => ({
  id: r.id, workspaceId: r.workspace_id, provider: r.provider, name: r.name, meta: r.public_meta ?? {}, status: r.status, lastError: r.last_error, agentIds,
});

/** A workspace's connections with the agents bound to each (service role; callers scope by their own workspace). */
export const listConnections = async (workspaceId: string, provider?: Provider): Promise<Array<Connection>> => {
  const db = supabaseAdmin();
  let q = db.from("connections").select(CONNECTION_SELECT).eq("workspace_id", workspaceId).order("created_at");
  if (provider) q = q.eq("provider", provider);
  const { data } = await q;
  const rows = (data ?? []) as Array<Row>;
  if (!rows.length) return [];
  const { data: links } = await db.from("agent_connections").select("agent_id, connection_id").in("connection_id", rows.map((r) => r.id));
  const byConn = new Map<string, Array<string>>();
  for (const l of (links ?? []) as Array<{ agent_id: string; connection_id: string }>) byConn.set(l.connection_id, [...(byConn.get(l.connection_id) ?? []), l.agent_id]);
  return rows.map((r) => toConnection(r, byConn.get(r.id) ?? []));
};

export const getConnection = async (workspaceId: string, connectionId: string): Promise<Connection | null> =>
  (await listConnections(workspaceId)).find((c) => c.id === connectionId) ?? null;

/** Server-side lookup with the decrypted credential and webhook secret. Null when missing, disconnected or undecryptable. */
export const loadConnectionSecret = async (connectionId: string, provider: Provider): Promise<{ workspaceId: string; credential: string; webhookSecret: string } | null> => {
  const db = supabaseAdmin();
  const { data: conn } = await db.from("connections").select("workspace_id, status, provider").eq("id", connectionId).maybeSingle();
  if (!conn || conn.provider !== provider || conn.status === "disconnected") return null;
  const { data: sec } = await db.from("connection_secrets").select("ciphertext, webhook_secret").eq("connection_id", connectionId).maybeSingle();
  if (!sec) return null;
  try {
    return { workspaceId: conn.workspace_id as string, credential: decryptSecret(sec.ciphertext as string), webhookSecret: sec.webhook_secret as string };
  } catch (e) {
    console.error("connection credential could not be decrypted", e instanceof Error ? e.message : e);
    return null;
  }
};

/**
 * The active agent of `module` that a connection is bound to (null when none: the message has nobody to answer it).
 * Bindings are what make a webhook act: an unbound connection stores the message and replies nothing.
 */
export const boundAgent = async (connectionId: string, module: "chatbot" | "accounting", purposes: ReadonlyArray<Purpose>): Promise<{ id: string } | null> => {
  const db = supabaseAdmin();
  const { data } = await db.from("agent_connections").select("agent_id, purpose, agents!inner(id, module, status, created_at)").eq("connection_id", connectionId).in("purpose", [...purposes]);
  type Link = { agents: { id: string; module: string; status: string; created_at: string } | Array<{ id: string; module: string; status: string; created_at: string }> };
  const agents = ((data ?? []) as unknown as Array<Link>)
    .map((l) => (Array.isArray(l.agents) ? l.agents[0] : l.agents))
    .filter((a) => a && a.module === module && a.status === "active")
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  return agents[0] ? { id: agents[0].id } : null;
};

/**
 * The bot token to answer as: the conversation's own connection when it has one, else the legacy env bot when the workspace
 * is TELEGRAM_WORKSPACE_ID. Null when there is no bot to send with.
 */
export const resolveBotToken = async (workspaceId: string, connectionId: string | null): Promise<string | null> => {
  if (connectionId) {
    const found = await loadConnectionSecret(connectionId, "telegram");
    return found && found.workspaceId === workspaceId ? found.credential : null;
  }
  return workspaceId === process.env.TELEGRAM_WORKSPACE_ID ? (process.env.TELEGRAM_BOT_TOKEN ?? null) : null;
};
