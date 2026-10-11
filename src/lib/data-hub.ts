import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { encryptSecret, decryptSecret } from "./channels";
import type { Provider } from "./connection-providers";
import { supabaseAdmin } from "./supabase/admin";

/**
 * The data hub: what a workspace's own systems hold (a database, an API, an import, a mailbox, a personal Telegram), in one
 * place (`data_records`, one row per connection + entity + source id). A workspace may have any number of connections of
 * each kind. Every connector implements `Connector.sync` (src/lib/connectors/<provider>.ts) and only writes through
 * `SyncContext.upsert`. Syncs run on the minute tick (runDueDataSyncs) or on demand (runDataSync), each recorded in
 * data_sync_runs. Credentials are the connection's encrypted secret (a JSON string the connector defines).
 */

export type DataProvider = "openapi" | "database" | "csv_import" | "imap" | "telegram_user";
export const DATA_PROVIDERS: ReadonlyArray<DataProvider> = ["openapi", "database", "csv_import", "imap", "telegram_user"];
export const isDataProvider = (p: string): p is DataProvider => (DATA_PROVIDERS as ReadonlyArray<string>).includes(p);

export type Entity = "customer" | "order" | "product" | "transaction" | "message" | "document" | "other";

/** One row for the hub. `externalId` is the source's own stable id (re-syncing the same id updates the row). */
export type RecordInput = {
  readonly externalId: string;
  readonly title?: string;
  readonly occurredAt?: string | Date | null;
  readonly data: Readonly<Record<string, unknown>>;
};

export type DataConnection = {
  readonly id: string;
  readonly workspaceId: string;
  readonly provider: DataProvider;
  readonly name: string;
  readonly meta: Readonly<Record<string, string>>;
  readonly lastSyncAt: string | null;
};

export type SyncContext = {
  readonly connection: DataConnection;
  /** The decrypted credential, as the connector stored it (usually JSON). */
  readonly credential: string;
  /** Writes rows of one entity; returns how many were written. Batches internally. */
  readonly upsert: (entity: Entity, rows: ReadonlyArray<RecordInput>) => Promise<number>;
  /** Aborted when the run's time budget is spent: stop early and return what was done. */
  readonly signal: AbortSignal;
};

export type SyncResult = { readonly rows: number; readonly note?: string; readonly meta?: Readonly<Record<string, string>> };

export type Connector = {
  /** Pull from the source into the hub. Throw a plain-language Error on failure (it is shown to the owner). */
  readonly sync: (ctx: SyncContext) => Promise<SyncResult>;
};

/* ------------------------------------------------------------------ network safety */

const PRIVATE_V4: ReadonlyArray<[number, number]> = [
  [0x00000000, 8], [0x0a000000, 8], [0x64400000, 10], [0x7f000000, 8], [0xa9fe0000, 16], [0xac100000, 12],
  [0xc0000000, 24], [0xc0a80000, 16], [0xc6120000, 15], [0xe0000000, 4], [0xf0000000, 4],
];
const v4ToInt = (ip: string) => ip.split(".").reduce((n, p) => (n << 8) + Number(p), 0) >>> 0;
const isPrivateV4 = (ip: string) => PRIVATE_V4.some(([base, bits]) => (v4ToInt(ip) >>> (32 - bits)) === (base >>> (32 - bits)));
const isPrivateV6 = (ip: string) => {
  const s = ip.toLowerCase();
  if (s === "::" || s === "::1") return true;
  if (s.startsWith("::ffff:")) return isPrivateV4(s.slice(7));
  return s.startsWith("fc") || s.startsWith("fd") || s.startsWith("fe8") || s.startsWith("fe9") || s.startsWith("fea") || s.startsWith("feb");
};

/** Private addresses are allowed only on a developer machine (DATA_ALLOW_PRIVATE_HOSTS=1), never in production. */
const allowPrivate = () => process.env.DATA_ALLOW_PRIVATE_HOSTS === "1";

/**
 * Resolves a host the owner typed and refuses loopback, private, link-local, CGNAT and metadata addresses (so a connector
 * can never be pointed at NIVO's own network). Returns the address to connect to: connect to THIS address, not the name,
 * so a DNS answer cannot change between the check and the connection.
 */
export const assertPublicHost = async (host: string): Promise<{ address: string; family: 4 | 6 }> => {
  const h = host.trim().replace(/^\[|\]$/g, "");
  if (!h || /[\s/]/.test(h)) throw new Error("Địa chỉ máy chủ không hợp lệ.");
  const answers = isIP(h) ? [{ address: h, family: isIP(h) as 4 | 6 }] : await lookup(h, { all: true }).catch(() => []);
  if (answers.length === 0) throw new Error(`Không tìm thấy máy chủ ${h}.`);
  if (!allowPrivate()) {
    for (const a of answers) {
      if ((a.family === 4 && isPrivateV4(a.address)) || (a.family === 6 && isPrivateV6(a.address))) {
        throw new Error(`${h} trỏ vào mạng nội bộ; NIVO chỉ kết nối tới địa chỉ công khai.`);
      }
    }
  }
  const first = answers[0] as { address: string; family: number };
  return { address: first.address, family: first.family === 6 ? 6 : 4 };
};

/** fetch() to a public http(s) URL only, with a time limit and a size cap. Redirects are followed manually and re-checked. */
export const safeFetch = async (rawUrl: string, init: RequestInit & { timeoutMs?: number; maxBytes?: number } = {}): Promise<{ status: number; headers: Headers; text: string }> => {
  let url = new URL(rawUrl);
  for (let hop = 0; hop < 4; hop++) {
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Chỉ hỗ trợ địa chỉ http hoặc https.");
    await assertPublicHost(url.hostname);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), init.timeoutMs ?? 15_000);
    try {
      const res = await fetch(url, { ...init, redirect: "manual", signal: ctrl.signal });
      if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
        url = new URL(res.headers.get("location") as string, url);
        continue;
      }
      const max = init.maxBytes ?? 5_000_000;
      const buf = await res.arrayBuffer();
      if (buf.byteLength > max) throw new Error(`Phản hồi quá lớn (hơn ${Math.round(max / 1_000_000)} MB).`);
      return { status: res.status, headers: res.headers, text: new TextDecoder().decode(buf) };
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error("Quá nhiều lần chuyển hướng.");
};

/* ------------------------------------------------------------------ connections */

/** Creates a data connection with its credential encrypted (any number per workspace and provider). Returns its id. */
export const createDataConnection = async (input: {
  readonly workspaceId: string; readonly userId: string; readonly provider: DataProvider; readonly name: string;
  readonly meta: Readonly<Record<string, string>>; readonly credential: string; readonly syncEveryMinutes: number | null;
  readonly status?: "pending" | "connected";
}): Promise<string> => {
  const db = supabaseAdmin();
  const { data: row, error } = await db.from("connections").insert({
    workspace_id: input.workspaceId, provider: input.provider, name: input.name, status: input.status ?? "connected", environment: "live",
    created_by: input.userId, public_meta: input.meta, sync_every_minutes: input.syncEveryMinutes,
    next_sync_at: input.syncEveryMinutes ? new Date().toISOString() : null,
  }).select("id").single();
  if (error || !row) throw new Error(error?.message ?? "connection not saved");
  const id = row.id as string;
  const saved = await db.from("connection_secrets").insert({ connection_id: id, ciphertext: encryptSecret(input.credential), webhook_secret: "" });
  if (saved.error) {
    await db.from("connections").delete().eq("id", id);
    throw new Error(saved.error.message);
  }
  return id;
};

/** Replaces a data connection's credential (encrypted). */
export const saveDataCredential = async (connectionId: string, credential: string): Promise<void> => {
  const { error } = await supabaseAdmin().from("connection_secrets").update({ ciphertext: encryptSecret(credential) }).eq("connection_id", connectionId);
  if (error) throw new Error(error.message);
};

/** The decrypted credential of a data connection of this workspace (null when missing). */
export const loadDataCredential = async (workspaceId: string, connectionId: string): Promise<string | null> => {
  const db = supabaseAdmin();
  const { data: conn } = await db.from("connections").select("id").eq("id", connectionId).eq("workspace_id", workspaceId).maybeSingle();
  if (!conn) return null;
  const { data: sec } = await db.from("connection_secrets").select("ciphertext").eq("connection_id", connectionId).maybeSingle<{ ciphertext: string }>();
  return sec ? decryptSecret(sec.ciphertext) : null;
};

/* ------------------------------------------------------------------ the hub */

const BATCH = 500;
const titleOf = (r: RecordInput) => (r.title ?? "").slice(0, 300);
const isoOf = (v: RecordInput["occurredAt"]) => (v ? new Date(v).toISOString() : null);

/** Upserts rows of one entity for one connection (unique per connection + entity + external id). */
export const upsertRecords = async (workspaceId: string, connectionId: string, entity: Entity, rows: ReadonlyArray<RecordInput>): Promise<number> => {
  const db = supabaseAdmin();
  let n = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH).filter((r) => r.externalId && String(r.externalId).length <= 300);
    if (!chunk.length) continue;
    const now = new Date().toISOString();
    const { error } = await db.from("data_records").upsert(
      chunk.map((r) => ({
        workspace_id: workspaceId, connection_id: connectionId, entity, external_id: String(r.externalId),
        title: titleOf(r), occurred_at: isoOf(r.occurredAt), data: r.data, synced_at: now,
      })),
      { onConflict: "connection_id,entity,external_id" },
    );
    if (error) throw new Error(error.message);
    n += chunk.length;
  }
  return n;
};

/** Hub rows an agent may read: only from connections it holds a grant on (any level). Simple text search on the title. */
export const searchRecordsForAgent = async (workspaceId: string, agentId: string, query: string, opts: { entity?: Entity; limit?: number } = {}) => {
  const db = supabaseAdmin();
  const { data: grants } = await db.from("agent_connections").select("connection_id").eq("workspace_id", workspaceId).eq("agent_id", agentId).in("purpose", ["data_source", "tool"]);
  const ids = ((grants ?? []) as Array<{ connection_id: string }>).map((g) => g.connection_id);
  if (!ids.length) return [];
  let q = db.from("data_records").select("entity, external_id, title, occurred_at, data, connection_id").eq("workspace_id", workspaceId).in("connection_id", ids);
  if (opts.entity) q = q.eq("entity", opts.entity);
  if (query.trim()) q = q.ilike("title", `%${query.trim().replace(/[%_]/g, "")}%`);
  const { data } = await q.order("occurred_at", { ascending: false, nullsFirst: false }).limit(Math.min(opts.limit ?? 20, 100));
  return data ?? [];
};

/* ------------------------------------------------------------------ running syncs */

type ConnRow = { id: string; workspace_id: string; provider: string; name: string; public_meta: Record<string, string> | null; last_sync_at: string | null; sync_every_minutes: number | null };

/** Runs one sync now (trigger: schedule | manual | upload | push), records it and moves the schedule. Never throws. */
export const runDataSync = async (connectionId: string, trigger: "schedule" | "manual" | "upload" | "push" = "manual", budgetMs = 25_000): Promise<{ ok: boolean; rows: number; error?: string }> => {
  const db = supabaseAdmin();
  const { data: c } = await db.from("connections").select("id, workspace_id, provider, name, public_meta, last_sync_at, sync_every_minutes, status").eq("id", connectionId).maybeSingle<ConnRow & { status: string }>();
  if (!c || c.status === "disconnected" || !isDataProvider(c.provider)) return { ok: false, rows: 0, error: "Không tìm thấy kết nối dữ liệu." };
  const { data: run } = await db.from("data_sync_runs").insert({ workspace_id: c.workspace_id, connection_id: c.id, trigger }).select("id").single<{ id: string }>();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), budgetMs);
  let rows = 0;
  try {
    const credential = (await loadDataCredential(c.workspace_id, c.id)) ?? "";
    const { CONNECTORS } = await import("./connectors");
    const connector = CONNECTORS[c.provider];
    const result = await connector.sync({
      connection: { id: c.id, workspaceId: c.workspace_id, provider: c.provider, name: c.name, meta: c.public_meta ?? {}, lastSyncAt: c.last_sync_at },
      credential,
      upsert: async (entity, list) => {
        const n = await upsertRecords(c.workspace_id, c.id, entity, list);
        rows += n;
        return n;
      },
      signal: ctrl.signal,
    });
    const now = new Date();
    await db.from("connections").update({
      status: "connected", last_error: null, last_sync_at: now.toISOString(), last_event_at: now.toISOString(),
      next_sync_at: c.sync_every_minutes ? new Date(now.getTime() + c.sync_every_minutes * 60_000).toISOString() : null,
      ...(result.meta ? { public_meta: { ...(c.public_meta ?? {}), ...result.meta } } : {}),
    }).eq("id", c.id);
    if (run) await db.from("data_sync_runs").update({ status: "ok", finished_at: now.toISOString(), rows_upserted: rows }).eq("id", run.id);
    return { ok: true, rows };
  } catch (e) {
    const message = (e instanceof Error ? e.message : String(e)).slice(0, 500);
    const now = new Date();
    await db.from("connections").update({
      status: "error", last_error: message,
      next_sync_at: c.sync_every_minutes ? new Date(now.getTime() + Math.max(c.sync_every_minutes, 15) * 60_000).toISOString() : null,
    }).eq("id", c.id);
    if (run) await db.from("data_sync_runs").update({ status: "failed", finished_at: now.toISOString(), rows_upserted: rows, error: message }).eq("id", run.id);
    return { ok: false, rows, error: message };
  } finally {
    clearTimeout(timer);
  }
};

/** The minute tick: runs the due data syncs one after another within a time budget (the rest wait for the next tick). */
export const runDueDataSyncs = async (budgetMs = 20_000): Promise<{ ran: number }> => {
  const started = Date.now();
  const { data } = await supabaseAdmin().from("connections").select("id")
    .in("provider", [...DATA_PROVIDERS]).neq("status", "disconnected").not("next_sync_at", "is", null).lte("next_sync_at", new Date().toISOString())
    .order("next_sync_at").limit(10);
  let ran = 0;
  for (const row of (data ?? []) as Array<{ id: string }>) {
    const left = budgetMs - (Date.now() - started);
    if (left < 3_000) break;
    await runDataSync(row.id, "schedule", left - 1_000);
    ran++;
  }
  return { ran };
};

export type { Provider };
