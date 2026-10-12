import { loadAgentDashboard } from "@/lib/agent-dashboard";
import { workbenchHref, type AgentDashboardData, type DashboardItem } from "@/lib/agent-dashboard-shared";
import { getSalesWorkbench, type SalesDecision, type SalesWorkbenchData } from "@/lib/workbench-sales";
import { SalesWorkbenchView } from "./view";

/** Props for {@link SalesWorkbench}. */
export type SalesWorkbenchProps = {
  /** `?tab=` from the route (attention, pipeline, decisions, handoff, contracts, activity); anything else opens the first tab. */
  readonly tab?: string | null;
  /** `?focus=` from the route: the decision a "Chờ bạn" row leads to (opens the Decisions tab on it). */
  readonly focus?: string | null;
};

const MAX_WAITING_ROWS = 5;

const decisionRow = (d: SalesDecision): DashboardItem => ({
  id: d.id,
  title: d.summary || d.draft.slice(0, 120) || d.customer,
  description: d.customer,
  at: d.createdAt,
  href: workbenchHref("sales", { tab: "decisions", focus: d.id }),
});

/**
 * "Chờ bạn" of Sales is the Decisions list itself (work items and legacy follow-up approvals), so the frame's region and the Decisions tab
 * always agree; the generic loader's list (work items only) is used when the workbench data could not be read.
 */
const withSalesWaiting = (dashboard: AgentDashboardData, data: SalesWorkbenchData | null): AgentDashboardData =>
  data === null
    ? dashboard
    : { ...dashboard, waiting: { ok: true, data: { total: data.decisions.length, items: data.decisions.slice(0, MAX_WAITING_ROWS).map(decisionRow) } } };

/** Connected Sales workbench: reads the flow data and still renders if the tables are not ready. */
const SalesWorkbench = async ({ tab = null, focus = null }: SalesWorkbenchProps = {}) => {
  const dashboard = loadAgentDashboard("sales", { decisionHref: (item) => workbenchHref("sales", { tab: "decisions", focus: item.id }) });
  let data: SalesWorkbenchData | null = null;
  try {
    data = await getSalesWorkbench();
  } catch (e) {
    console.error("sales workbench failed", e instanceof Error ? e.message : e);
  }
  return <SalesWorkbenchView data={data} dashboard={withSalesWaiting(await dashboard, data)} initialTab={tab} initialFocus={focus} />;
};

export default SalesWorkbench;
