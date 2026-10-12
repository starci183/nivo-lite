/** Agent dashboard: the plain data the shared frame (features/agent-dashboard) renders. No I/O, safe in client components. The loader is lib/agent-dashboard.ts. */
import type { Access, Purpose } from "./connection-access";
import { agentHref, type ModuleKey, type OperatingMode } from "./modules-shared";

/** One region's data, or the fact that it could not be read: a failed region fails in place and never takes the page down (STATE-8). */
export type Region<T> = { readonly ok: true; readonly data: T } | { readonly ok: false };

/** One line of a list region: a decision waiting, or something the agent finished. */
export type DashboardItem = {
  readonly id: string;
  readonly title: string;
  /** One supporting line (who it is about, what kind of work). */
  readonly description?: string;
  /** When it was raised (waiting) or finished (done), ISO. */
  readonly at: string | null;
  /** Where the row leads: the decision itself, or the evidence. */
  readonly href: string;
};

/** "Chờ bạn": the decisions of this module that wait for a person. `items` is the oldest few; `total` counts all of them. */
export type WaitingData = { readonly total: number; readonly items: ReadonlyArray<DashboardItem> };
/** "Đã tự làm 7 ngày": the work finished by policy in the last 7 days. `count` is all of it, `items` the latest few. */
export type DoneData = { readonly count: number; readonly items: ReadonlyArray<DashboardItem> };

/** One connection bound to the agent (agent_connections). */
export type ConnectionItem = {
  readonly id: string;
  readonly name: string;
  /** The provider's name, already in the reader's language. */
  readonly providerLabel: string;
  readonly status: "connected" | "error" | "pending";
  readonly access: Access;
  readonly purpose: Purpose;
};

/** One question the agent could not answer (knowledge_gaps), most asked first. */
export type GapItem = { readonly id: string; readonly question: string; readonly count: number; readonly lastSeenAt: string };

/**
 * "Tri thức": what the agent can read (its lens) and, when the knowledge_gaps table exists and the reader may see it, the open gaps.
 * `gaps` is null when the table is missing or the reader is not a manager: the region then shows no gaps block at all.
 */
export type KnowledgeData = {
  readonly audience: "customer" | "internal";
  readonly documents: { readonly public: number; readonly internal: number };
  readonly facts: { readonly public: number; readonly internal: number; readonly restricted: number };
  readonly gaps: { readonly openCount: number; readonly items: ReadonlyArray<GapItem> } | null;
};

/** Everything the frame's common regions need for one module. */
export type AgentDashboardData = {
  /** null when the module has no agent yet (the module layout normally redirects first). */
  readonly agent: { readonly id: string; readonly name: string; readonly mode: OperatingMode } | null;
  readonly waiting: Region<WaitingData>;
  readonly done: Region<DoneData>;
  readonly connections: Region<ReadonlyArray<ConnectionItem>>;
  readonly knowledge: Region<KnowledgeData>;
};

/**
 * Where a module's workbench lives, optionally on a tab and focused on one record: `?tab=` and `?focus=` are the frame's shared contract.
 * With `installationId` it is that instance's workbench; without, the type-level URL (redirects to the only instance or to the focus's owner).
 */
export const workbenchHref = (module: ModuleKey, opts: { readonly tab?: string; readonly focus?: string; readonly installationId?: string | null } = {}): string => {
  const q = new URLSearchParams();
  if (opts.tab) q.set("tab", opts.tab);
  if (opts.focus) q.set("focus", opts.focus);
  return agentHref(module, opts.installationId ?? null, "workbench", q.toString());
};
