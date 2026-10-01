import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Reads for the team console. Service-role client, server components only: callers must have passed requirePlatformAdmin().
 * Optional tables (openclaw_agent_sync) are guarded: a missing table or column yields an empty list, never a broken page.
 */
type Db = ReturnType<typeof supabaseAdmin>;
type Row = Record<string, unknown>;

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/** A live connection with no event for this long is "silent". */
export const SILENT_AFTER_MS = 3 * DAY;

const rows = async <T = Row>(q: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T[]> => {
  const { data, error } = await q;
  return error ? [] : ((data ?? []) as T[]);
};

/** Owner / member emails by user id (auth.users is only reachable through the admin API). */
export const emailsOf = async (db: Db, ids: ReadonlyArray<string>): Promise<Map<string, string>> => {
  const out = new Map<string, string>();
  await Promise.all([...new Set(ids)].map(async (id) => {
    const { data } = await db.auth.admin.getUserById(id);
    if (data.user?.email) out.set(id, data.user.email);
  }));
  return out;
};

export type ConnectionHealth = "ok" | "error" | "silent";
export const connectionHealth = (c: { status: string; environment?: string | null; last_event_at: string | null; created_at: string }, now = Date.now()): ConnectionHealth => {
  if (c.status === "error") return "error";
  if (c.status === "connected" && (c.environment ?? "live") === "live") {
    const since = new Date(c.last_event_at ?? c.created_at).getTime();
    if (now - since > SILENT_AFTER_MS) return "silent";
  }
  return "ok";
};

/* ---------------------------------------------------------------- workspaces list */

export type WorkspaceListItem = {
  id: string; name: string; ownerEmail: string; status: string; planCode: string | null; paidUntil: string | null; createdAt: string;
  members: number;
  modules: Array<{ key: string; status: string; live: boolean }>;
  connections: Array<{ provider: string; count: number; error: number; silent: number }>;
  connectionWarning: boolean;
  lastCustomerMessageAt: string | null; messages7d: number; openDecisions: number;
  failedJobs24h: number; errors24h: number;
  attention: boolean; unpaid: boolean; idle7d: boolean;
};

export const loadWorkspaceList = async (): Promise<WorkspaceListItem[]> => {
  const db = supabaseAdmin();
  const since24 = new Date(Date.now() - DAY).toISOString();
  const [ws, stats, mods, conns, failed, errs] = await Promise.all([
    rows<{ id: string; owner_id: string; name: string; status: string; plan_code: string | null; paid_until: string | null; created_at: string }>(
      db.from("workspaces").select("id, owner_id, name, status, plan_code, paid_until, created_at").order("created_at", { ascending: false }).limit(1000)),
    rows<{ workspace_id: string; members: number; last_customer_message_at: string | null; messages_7d: number; open_decisions: number }>(db.rpc("admin_workspace_stats")),
    rows<{ workspace_id: string; module_key: string; status: string; live_enabled: boolean }>(db.from("module_installations").select("workspace_id, module_key, status, live_enabled").limit(5000)),
    rows<{ workspace_id: string; provider: string; status: string; environment: string | null; last_event_at: string | null; created_at: string }>(
      db.from("connections").select("workspace_id, provider, status, environment, last_event_at, created_at").neq("status", "disconnected").limit(5000)),
    rows<{ workspace_id: string | null }>(db.from("engine_jobs").select("workspace_id").eq("status", "failed").gte("finished_at", since24).limit(5000)),
    rows<{ workspace_id: string | null }>(db.from("app_errors").select("workspace_id").gte("created_at", since24).not("workspace_id", "is", null).limit(5000)),
  ]);
  const owners = await emailsOf(db, ws.map((w) => w.owner_id));
  const statBy = new Map(stats.map((s) => [s.workspace_id, s]));
  const count = (list: ReadonlyArray<{ workspace_id: string | null }>) => {
    const m = new Map<string, number>();
    for (const r of list) if (r.workspace_id) m.set(r.workspace_id, (m.get(r.workspace_id) ?? 0) + 1);
    return m;
  };
  const failedBy = count(failed);
  const errorsBy = count(errs);
  const now = Date.now();

  return ws.map((w) => {
    const s = statBy.get(w.id);
    const myConns = conns.filter((c) => c.workspace_id === w.id);
    const byProvider = new Map<string, { provider: string; count: number; error: number; silent: number }>();
    for (const c of myConns) {
      const e = byProvider.get(c.provider) ?? { provider: c.provider, count: 0, error: 0, silent: 0 };
      const h = connectionHealth(c, now);
      e.count += 1;
      if (h === "error") e.error += 1;
      if (h === "silent") e.silent += 1;
      byProvider.set(c.provider, e);
    }
    const connections = [...byProvider.values()];
    const connectionWarning = connections.some((c) => c.error + c.silent > 0);
    const failedJobs24h = failedBy.get(w.id) ?? 0;
    const errors24h = errorsBy.get(w.id) ?? 0;
    const messages7d = s?.messages_7d ?? 0;
    const unpaid = w.status === "pending_payment" || w.status === "past_due" || (w.paid_until !== null && new Date(w.paid_until).getTime() < now && w.status !== "cancelled");
    return {
      id: w.id, name: w.name, ownerEmail: owners.get(w.owner_id) ?? "—", status: w.status, planCode: w.plan_code, paidUntil: w.paid_until, createdAt: w.created_at,
      members: s?.members ?? 0,
      modules: mods.filter((m) => m.workspace_id === w.id).map((m) => ({ key: m.module_key, status: m.status, live: m.live_enabled })),
      connections, connectionWarning,
      lastCustomerMessageAt: s?.last_customer_message_at ?? null, messages7d, openDecisions: s?.open_decisions ?? 0,
      failedJobs24h, errors24h,
      attention: connectionWarning || failedJobs24h > 0 || errors24h > 0 || w.status === "past_due",
      unpaid,
      idle7d: messages7d === 0,
    };
  });
};

/* ---------------------------------------------------------------- workspace detail */

export type WorkspaceDetail = NonNullable<Awaited<ReturnType<typeof loadWorkspaceDetail>>>;

export const loadWorkspaceDetail = async (id: string) => {
  const db = supabaseAdmin();
  const { data: ws } = await db.from("workspaces").select("id, owner_id, name, status, plan_code, paid_until, created_at").eq("id", id).maybeSingle<{
    id: string; owner_id: string; name: string; status: string; plan_code: string | null; paid_until: string | null; created_at: string }>();
  if (!ws) return null;
  const [members, invites, orders, billingEvents, installs, versions, sync, conns, errors, jobs, sources, stats] = await Promise.all([
    rows<{ user_id: string; role: string; display_name: string; status: string; created_at: string }>(db.from("workspace_members").select("user_id, role, display_name, status, created_at").eq("workspace_id", id).order("created_at")),
    rows<{ id: string; email: string; role: string; created_at: string; expires_at: string }>(
      db.from("workspace_invites").select("id, email, role, created_at, expires_at").eq("workspace_id", id).is("accepted_at", null).is("revoked_at", null).order("created_at", { ascending: false })),
    rows<{ id: string; order_code: string; plan_code: string; amount_vnd: number; status: string; created_at: string; paid_at: string | null; sepay_transaction_id: number | null }>(
      db.from("payment_orders").select("id, order_code, plan_code, amount_vnd, status, created_at, paid_at, sepay_transaction_id").eq("workspace_id", id).order("created_at", { ascending: false }).limit(30)),
    rows<{ id: string; kind: string; data: Record<string, unknown>; created_at: string }>(db.from("billing_events").select("id, kind, data, created_at").eq("workspace_id", id).order("created_at", { ascending: false }).limit(20)),
    rows<{ id: string; module_key: string; status: string; operating_mode: string; live_enabled: boolean; active_context_version_id: string | null; settings: Record<string, unknown> | null }>(
      db.from("module_installations").select("id, module_key, status, operating_mode, live_enabled, active_context_version_id, settings").eq("workspace_id", id)),
    rows<{ id: string; installation_id: string; version: number; applied_at: string }>(db.from("module_context_versions").select("id, installation_id, version, applied_at").eq("workspace_id", id)),
    rows<{ installation_id: string; agent_id: string; context_version: number | null; synced_at: string | null; checked_at: string; status: string; error: string | null }>(
      db.from("openclaw_agent_sync").select("installation_id, agent_id, context_version, synced_at, checked_at, status, error").eq("workspace_id", id)),
    rows<{ id: string; provider: string; name: string; status: string; environment: string | null; last_event_at: string | null; last_error: string | null; created_at: string }>(
      db.from("connections").select("id, provider, name, status, environment, last_event_at, last_error, created_at").eq("workspace_id", id).order("created_at")),
    rows<{ id: string; scope: string; message: string; created_at: string }>(db.from("app_errors").select("id, scope, message, created_at").eq("workspace_id", id).order("created_at", { ascending: false }).limit(20)),
    rows<{ id: string; kind: string; status: string; attempts: number; max_attempts: number; error: string | null; created_at: string; run_at: string }>(
      db.from("engine_jobs").select("id, kind, status, attempts, max_attempts, error, created_at, run_at").eq("workspace_id", id).in("status", ["failed", "queued", "running"]).order("created_at", { ascending: false }).limit(30)),
    rows<{ kind: string; status: string }>(db.from("knowledge_sources").select("kind, status").eq("workspace_id", id).limit(5000)),
    rows<{ workspace_id: string; messages_7d: number; last_customer_message_at: string | null; open_decisions: number }>(db.rpc("admin_workspace_stats")),
  ]);
  const sepay = orders.length
    ? await rows<{ sepay_id: number; transfer_amount: number | null; content: string | null; status: string; received_at: string }>(
        db.from("sepay_transactions").select("sepay_id, transfer_amount, content, status, received_at").in("matched_order_id", orders.map((o) => o.id)).order("received_at", { ascending: false }).limit(30))
    : [];
  const emails = await emailsOf(db, [ws.owner_id, ...members.map((m) => m.user_id)]);
  const my = stats.find((s) => s.workspace_id === id);
  const verOf = new Map(versions.map((v) => [v.id, v]));
  const now = Date.now();
  const kinds = new Map<string, Record<string, number>>();
  for (const s of sources) {
    const e = kinds.get(s.kind) ?? {};
    e[s.status] = (e[s.status] ?? 0) + 1;
    kinds.set(s.kind, e);
  }
  return {
    ws: { ...ws, ownerEmail: emails.get(ws.owner_id) ?? "—" },
    members: members.map((m) => ({ ...m, email: emails.get(m.user_id) ?? "—" })),
    invites, orders, sepay, billingEvents,
    modules: installs.map((i) => ({
      ...i,
      processor: i.settings?.processor === "openclaw" ? "openclaw" : "nivo",
      contextVersion: i.active_context_version_id ? verOf.get(i.active_context_version_id)?.version ?? null : null,
      contextAppliedAt: i.active_context_version_id ? verOf.get(i.active_context_version_id)?.applied_at ?? null : null,
      sync: sync.find((s) => s.installation_id === i.id) ?? null,
    })),
    connections: conns.map((c) => ({ ...c, health: connectionHealth(c, now) })),
    errors, jobs,
    knowledge: { total: sources.length, byKind: [...kinds.entries()].map(([kind, byStatus]) => ({ kind, byStatus })) },
    activity: { messages7d: my?.messages_7d ?? 0, lastCustomerMessageAt: my?.last_customer_message_at ?? null, openDecisions: my?.open_decisions ?? 0 },
  };
};

/* ---------------------------------------------------------------- platform health */

export const loadHealth = async () => {
  const db = supabaseAdmin();
  const since24 = new Date(Date.now() - DAY).toISOString();
  const [workers, queue, failed, signups, sepay, billingEvents, errors, errorsByScope, audits] = await Promise.all([
    rows<{ worker_id: string; version: string; kinds: string[]; started_at: string; last_heartbeat_at: string }>(db.from("engine_workers").select("worker_id, version, kinds, started_at, last_heartbeat_at").order("last_heartbeat_at", { ascending: false })),
    rows<{ kind: string; status: string }>(db.from("engine_jobs").select("kind, status").in("status", ["queued", "running"]).limit(10000)),
    rows<{ id: string; workspace_id: string | null; kind: string; attempts: number; error: string | null; finished_at: string | null }>(
      db.from("engine_jobs").select("id, workspace_id, kind, attempts, error, finished_at").eq("status", "failed").gte("finished_at", since24).order("finished_at", { ascending: false }).limit(50)),
    rows<{ day: string; signups: number }>(db.rpc("admin_signups_per_day", { p_days: 14 })),
    rows<{ status: string; transfer_amount: number | null; content: string | null; received_at: string }>(db.from("sepay_transactions").select("status, transfer_amount, content, received_at").order("received_at", { ascending: false }).limit(25)),
    rows<{ id: string; workspace_id: string | null; kind: string; created_at: string }>(db.from("billing_events").select("id, workspace_id, kind, created_at").order("created_at", { ascending: false }).limit(25)),
    rows<{ id: string; scope: string; message: string; workspace_id: string | null; created_at: string }>(db.from("app_errors").select("id, scope, message, workspace_id, created_at").order("created_at", { ascending: false }).limit(50)),
    rows<{ scope: string }>(db.from("app_errors").select("scope").gte("created_at", since24).limit(5000)),
    rows<{ id: string; actor_email: string; action: string; workspace_id: string | null; created_at: string }>(db.from("platform_audit").select("id, actor_email, action, workspace_id, created_at").neq("action", "view.health").order("created_at", { ascending: false }).limit(15)),
  ]);
  const depth = new Map<string, { kind: string; queued: number; running: number }>();
  for (const j of queue) {
    const e = depth.get(j.kind) ?? { kind: j.kind, queued: 0, running: 0 };
    if (j.status === "queued") e.queued += 1; else e.running += 1;
    depth.set(j.kind, e);
  }
  const scopes = new Map<string, number>();
  for (const e of errorsByScope) scopes.set(e.scope, (scopes.get(e.scope) ?? 0) + 1);
  const names = new Map((await rows<{ id: string; name: string }>(db.from("workspaces").select("id, name").in("id", [...new Set([...failed, ...errors, ...billingEvents, ...audits].map((r) => r.workspace_id).filter((v): v is string => !!v))]))).map((w) => [w.id, w.name]));
  const sepayCounts = new Map<string, number>();
  for (const s of sepay) sepayCounts.set(s.status, (sepayCounts.get(s.status) ?? 0) + 1);
  return {
    workers, queue: [...depth.values()].sort((a, b) => b.queued - a.queued), failed, signups, sepay, sepayCounts: [...sepayCounts.entries()], billingEvents,
    errors, errorsByScope: [...scopes.entries()].sort((a, b) => b[1] - a[1]), audits, workspaceNames: names,
  };
};
