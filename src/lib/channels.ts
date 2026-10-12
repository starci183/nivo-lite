import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "./supabase/admin";
import { agentsFor } from "./agent-bindings";

/**
 * Per-workspace connections (Telegram bots, SePay bank feeds, Zalo OA config). Non-secret facts live in `connections` (members
 * read them under RLS); the encrypted credential and the webhook secret live in `connection_secrets` (service role only).
 * Encryption is AES-256-GCM in app code with env CHANNEL_TOKEN_KEY (32 bytes, base64). Stored form: base64(iv(12) | tag(16) | ciphertext).
 * Which agent uses which connection is `agent_connections`; a webhook only acts for a connection bound to the right active agent.
 */
export type { Provider, Environment } from "./connection-providers";
import type { Environment, Provider } from "./connection-providers";
/** `pending`: created by the wizard; set up but no first webhook seen yet (or the wizard was abandoned). */
export type ConnectionStatus = "pending" | "connected" | "error" | "disconnected";
export type { Purpose, Access } from "./connection-access";
import type { Access, Purpose } from "./connection-access";

export type FirstEvent = { readonly amount: number; readonly content: string; readonly at: string };

export type Connection = {
  readonly id: string;
  readonly workspaceId: string;
  readonly provider: Provider;
  readonly name: string;
  /** Non-secret facts: bot_username, bot_id, account_masked, bank_code, account_holder, oa_id, app_id ... */
  readonly meta: Readonly<Record<string, string>>;
  readonly status: ConnectionStatus;
  readonly lastError: string | null;
  /** `test` = the provider's test mode: its credits are stored as simulated, never real money. */
  readonly environment: Environment;
  /** SMTP only: the workspace default sender. */
  readonly isDefault: boolean;
  readonly lastEventAt: string | null;
  /** The first webhook the connection accepted (what the wizard shows as "received +X d"). */
  readonly firstEvent: FirstEvent | null;
  /** Ids of the agents that use this connection. */
  readonly agentIds: ReadonlyArray<string>;
  /** Each agent's access level through this connection (same agents as agentIds). */
  readonly grants: ReadonlyArray<{ readonly agentId: string; readonly access: Access }>;
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
  return provider === "telegram" ? `${base}/api/telegram/${connectionId}` : `${base}/api/connections/${provider === "zalo_oa" ? "zalo" : provider}/${connectionId}`;
};

type Row = { id: string; workspace_id: string; provider: Provider; name: string; public_meta: Record<string, string> | null; status: ConnectionStatus; last_error: string | null; environment: Environment; is_default: boolean | null; last_event_at: string | null; first_event: FirstEvent | null };
export const CONNECTION_SELECT = "id, workspace_id, provider, name, public_meta, status, last_error, environment, is_default, last_event_at, first_event";
const toConnection = (r: Row, grants: ReadonlyArray<{ agentId: string; access: Access }>): Connection => ({
  id: r.id, workspaceId: r.workspace_id, provider: r.provider, name: r.name, meta: r.public_meta ?? {}, status: r.status, lastError: r.last_error,
  environment: r.environment ?? "live", isDefault: Boolean(r.is_default), lastEventAt: r.last_event_at, firstEvent: r.first_event, agentIds: grants.map((g) => g.agentId), grants,
});

/** A workspace's connections with the agents bound to each (service role; callers scope by their own workspace). */
export const listConnections = async (workspaceId: string, provider?: Provider): Promise<Array<Connection>> => {
  const db = supabaseAdmin();
  let q = db.from("connections").select(CONNECTION_SELECT).eq("workspace_id", workspaceId).order("created_at");
  if (provider) q = q.eq("provider", provider);
  else q = q.neq("provider", "google_drive"); // the Drive read grant (knowledge/drive-grant.ts) lives in the Add documents drawer, not in the channel list
  const { data } = await q;
  const rows = (data ?? []) as Array<Row>;
  if (!rows.length) return [];
  const { data: links } = await db.from("agent_connections").select("agent_id, connection_id, access").in("connection_id", rows.map((r) => r.id));
  const byConn = new Map<string, Array<{ agentId: string; access: Access }>>();
  for (const l of (links ?? []) as Array<{ agent_id: string; connection_id: string; access: Access | null }>) {
    byConn.set(l.connection_id, [...(byConn.get(l.connection_id) ?? []), { agentId: l.agent_id, access: l.access ?? "auto" }]);
  }
  return rows.map((r) => toConnection(r, byConn.get(r.id) ?? []));
};

export const getConnection = async (workspaceId: string, connectionId: string): Promise<Connection | null> =>
  (await listConnections(workspaceId)).find((c) => c.id === connectionId) ?? null;

/** Server-side lookup with the decrypted credential and webhook secret. Null when missing, disconnected or undecryptable. */
export const loadConnectionSecret = async (connectionId: string, provider: Provider): Promise<{ workspaceId: string; credential: string; webhookSecret: string } | null> => {
  const db = supabaseAdmin();
  // Both rows in one wave; the secret is only decrypted once the connection row checks out.
  const [{ data: conn }, { data: sec }] = await Promise.all([
    db.from("connections").select("workspace_id, status, provider").eq("id", connectionId).maybeSingle(),
    db.from("connection_secrets").select("ciphertext, webhook_secret").eq("connection_id", connectionId).maybeSingle(),
  ]);
  if (!conn || conn.provider !== provider || conn.status === "disconnected") return null;
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
 * Bindings are what make a webhook act: an unbound connection stores the message and replies nothing. With `acting`, an agent
 * that may only read through the connection does not count: the message is stored and nobody answers it.
 */
export const boundAgent = async (
  connectionId: string, module: "chatbot" | "accounting", purposes: ReadonlyArray<Purpose>, opts: { readonly acting?: boolean } = {},
): Promise<{ id: string; access: Access } | null> => {
  const first = (await agentsFor(connectionId, purposes, { modules: [module], ...(opts.acting ? { acting: true } : {}) }))[0];
  return first ? { id: first.id, access: first.access } : null;
};

/** The access of the agents bound to the connection a conversation came in on, strongest first (empty: not bound, or no connection). */
export const conversationAccess = async (conversationId: string): Promise<{ connectionId: string | null; grants: Array<{ agentId: string; module: string; access: Access }> }> => {
  const db = supabaseAdmin();
  const { data: conv } = await db.from("agent_conversations").select("connection_id").eq("id", conversationId).maybeSingle<{ connection_id: string | null }>();
  if (!conv?.connection_id) return { connectionId: null, grants: [] };
  const { data } = await db.from("agent_connections").select("agent_id, access, agents!inner(module, status)").eq("connection_id", conv.connection_id);
  type Link = { agent_id: string; access: Access | null; agents: { module: string; status: string } | Array<{ module: string; status: string }> };
  const grants = ((data ?? []) as unknown as Array<Link>).flatMap((l) => {
    const a = Array.isArray(l.agents) ? l.agents[0] : l.agents;
    return a && a.status === "active" ? [{ agentId: l.agent_id, module: a.module, access: l.access ?? "auto" }] : [];
  });
  return { connectionId: conv.connection_id, grants };
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
