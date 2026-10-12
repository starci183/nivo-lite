import "server-only";
import { translator } from "@/i18n/core";
import { governance } from "@/i18n/dict/governance";
import { connectionsFor } from "./agent-bindings";
import type { AgentDashboardData, ConnectionItem, DashboardItem, DoneData, GapItem, KnowledgeData, Region, WaitingData } from "./agent-dashboard-shared";
import { workbenchHref } from "./agent-dashboard-shared";
import type { Purpose } from "./connection-access";
import { PROVIDERS, type Provider } from "./connection-providers";
import { engineCtx } from "./flow-ctx";
import { isTestRunName, isTestRunWorkItem, listExceptions } from "./flow-queries";
import type { WorkItemView } from "./flow-types";
import { lensCounts, lensFor } from "./knowledge/lens";
import { isManagerRole } from "./members-shared";
import { pick } from "./module-registry";
import { getInstallation, type ModuleKey } from "./modules-core";

/**
 * Loader of the agent dashboard frame's common regions (features/agent-dashboard). One call per module page:
 *
 *   const dashboard = await loadAgentDashboard("sales");
 *
 * Every region is read on its own and fails on its own (Region.ok === false): a broken knowledge count never hides the waiting list.
 * Test runs (UAT / DBG names, see flow-queries TEST_RUN_PATTERN) are left out of every count and list here.
 *
 *   agent        the module's installed agent: name and operating mode (assist / autopilot).
 *   waiting      "Chờ bạn": work items of this module in waiting_decision, oldest first. Each links to opts.decisionHref(item),
 *                default /m/<module>/workbench?focus=<work item id> (a workbench reads ?tab= and ?focus=; see workbenchHref).
 *   done         "Đã tự làm 7 ngày": work items of this module finished by policy (decided_path "auto") in the last 7 days.
 *   connections  "Kết nối": the connections bound to the agent in agent_connections, with their status and the agent's access.
 *   knowledge    "Tri thức": the agent's lens counts (what it can read) and, if the knowledge_gaps table exists, its open gaps.
 */

const DAY_MS = 86_400_000;
const LIST_LIMIT = 5;
const DONE_SCAN_LIMIT = 500;
const PURPOSES: ReadonlyArray<Purpose> = ["inbound_chat", "outbound_chat", "bank_feed", "data_source", "tool"];

export type LoadAgentDashboardOptions = {
  /** Where a waiting item leads. Default: the module's workbench focused on the item. */
  readonly decisionHref?: (item: WorkItemView) => string;
};

type Ctx = Awaited<ReturnType<typeof engineCtx>>;

const clip = (text: string, n = 140): string => {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t;
};

const settle = async <T,>(label: string, read: () => Promise<T>): Promise<Region<T>> => {
  try {
    return { ok: true, data: await read() };
  } catch (e) {
    console.error(`agent dashboard ${label} failed`, e instanceof Error ? e.message : e);
    return { ok: false };
  }
};

type DoneLead = { contact_name: string | null; company: string | null };
type DoneRow = {
  id: string; action: string; lead_id: string | null; completed_at: string | null; updated_at: string;
  result: { summary?: string; href?: string } | null; summary: string | null; contact: string | null; customer: string | null;
  lead: DoneLead | Array<DoneLead> | null;
};

const firstOf = <T,>(v: T | Array<T> | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

/**
 * Open knowledge gaps of the module, most asked first. The knowledge_gaps table is added by another change, so this is a safe read:
 * a missing table, a failed query or a reader who is not a manager (the table is manager-only) all mean "no gaps block" (null), never an error.
 */
const openGaps = async (module: ModuleKey, c: Ctx): Promise<KnowledgeData["gaps"]> => {
  if (!isManagerRole(c.session.member.role)) return null;
  try {
    const { data, count, error } = await c.db.from("knowledge_gaps").select("id, question, count, last_seen_at", { count: "exact" })
      .eq("workspace_id", c.ws).eq("module", module).eq("status", "open").order("count", { ascending: false }).limit(3);
    if (error) return null;
    const items: Array<GapItem> = ((data ?? []) as Array<{ id: string; question: string; count: number; last_seen_at: string }>)
      .map((g) => ({ id: g.id, question: clip(g.question, 120), count: g.count, lastSeenAt: g.last_seen_at }));
    return { openCount: count ?? items.length, items };
  } catch {
    return null;
  }
};

export const loadAgentDashboard = async (module: ModuleKey, opts: LoadAgentDashboardOptions = {}): Promise<AgentDashboardData> => {
  const c = await engineCtx();
  const t = translator(governance, c.locale) as (key: string) => string;
  const actionLabel = (action: string): string => {
    const label = t(action);
    return label === action ? "" : label;
  };
  const installation = await getInstallation(module);

  const waiting = settle<WaitingData>("waiting", async () => {
    const rows = (await listExceptions()).filter((i) => i.department === module && i.status === "waiting_decision" && !isTestRunWorkItem(i));
    const href = opts.decisionHref ?? ((i: WorkItemView) => workbenchHref(module, { focus: i.id }));
    const items: Array<DashboardItem> = rows.slice(0, LIST_LIMIT).map((i) => {
      const customer = i.lead?.contact_name ?? (typeof i.proposal.fields?.customer === "string" ? i.proposal.fields.customer : "");
      return {
        id: i.id,
        title: clip(i.proposal.summary) || actionLabel(i.action) || i.action,
        description: [customer, actionLabel(i.action)].filter(Boolean).join(" · ") || undefined,
        at: i.created_at,
        href: href(i),
      };
    });
    return { total: rows.length, items };
  });

  const done = settle<DoneData>("done", async () => {
    const since = new Date(Date.now() - 7 * DAY_MS).toISOString();
    const { data, error } = await c.db.from("work_items")
      .select("id, action, lead_id, completed_at, updated_at, result, summary:proposal->>summary, contact:proposal->fields->>contact_name, customer:proposal->fields->>customer, lead:leads(contact_name, company)")
      .eq("workspace_id", c.ws).eq("department", module).eq("status", "done").eq("decided_path", "auto").gte("completed_at", since)
      .order("completed_at", { ascending: false }).limit(DONE_SCAN_LIMIT);
    if (error) throw new Error(error.message);
    const rows = ((data ?? []) as unknown as Array<DoneRow>).filter((r) => {
      const lead = firstOf(r.lead);
      return !isTestRunName(lead?.contact_name, lead?.company, r.summary, r.contact, r.customer);
    });
    const items: Array<DashboardItem> = rows.slice(0, LIST_LIMIT).map((r) => ({
      id: r.id,
      title: clip(r.result?.summary || r.summary || "") || actionLabel(r.action) || r.action,
      description: [firstOf(r.lead)?.contact_name ?? r.customer ?? "", actionLabel(r.action)].filter(Boolean).join(" · ") || undefined,
      at: r.completed_at ?? r.updated_at,
      href: r.result?.href || (r.lead_id ? `/leads/${r.lead_id}` : `/decisions?kind=policy&dept=${module}`),
    }));
    return { count: rows.length, items };
  });

  const connections = settle<ReadonlyArray<ConnectionItem>>("connections", async () => {
    if (!installation?.agentId) return [];
    const bound = await connectionsFor(installation.agentId, PURPOSES);
    const seen = new Set<string>();
    const items: Array<ConnectionItem> = [];
    for (const b of bound) {
      if (seen.has(b.id)) continue;
      seen.add(b.id);
      const def = (PROVIDERS as Readonly<Record<string, (typeof PROVIDERS)[Provider] | undefined>>)[b.provider];
      items.push({
        id: b.id, name: b.name, providerLabel: def ? pick(def.title, c.locale) : b.provider,
        status: b.status === "connected" ? "connected" : b.status === "error" ? "error" : "pending", access: b.access, purpose: b.purpose,
      });
    }
    return items;
  });

  const knowledge = settle<KnowledgeData>("knowledge", async () => {
    const counts = await lensCounts(lensFor(c.ws, module), c.db as never);
    return { ...counts, gaps: await openGaps(module, c) };
  });

  const [w, d, conn, k] = await Promise.all([waiting, done, connections, knowledge]);
  return {
    agent: installation?.agentId ? { id: installation.agentId, name: installation.agentName, mode: installation.operatingMode } : null,
    waiting: w, done: d, connections: conn, knowledge: k,
  };
};
