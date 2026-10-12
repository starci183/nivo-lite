import { loadAgentDashboard } from "@/lib/agent-dashboard";
import { workbenchHref } from "@/lib/agent-dashboard-shared";
import type { Installation } from "@/lib/modules-shared";
import { getLeadGenWorkbench } from "@/lib/workbench-lead-gen";
import { LeadGenWorkbenchView } from "./view";

/** Props for {@link WorkbenchLeadGen}. */
export type LeadGenWorkbenchProps = {
  /** `?tab=` from the route (leads, sources, comments, handoffs); anything else opens the first tab. */
  readonly tab?: string | null;
  /** `?focus=` from the route: the comment work item a waiting row leads to (opens the Comments tab on it). */
  readonly focus?: string | null;
  /** The Lead-gen agent instance (one per page or ad account): only its prospects, sources and decisions. */
  readonly installation?: Installation | null;
};

/**
 * Workbench slot of /agents/lead_gen/workbench: the agent dashboard frame around the four Lead Gen areas.
 * A failed read throws to the route's RouteError (app/(console)/agents/[module]/workbench/error.tsx); the STATE-8 loading view is ./loading.
 * A waiting row of the frame opens the Comments tab on that item.
 */
const WorkbenchLeadGen = async ({ tab = null, focus = null, installation = null }: LeadGenWorkbenchProps = {}) => {
  const installationId = installation?.id ?? null;
  const [dashboard, data] = await Promise.all([
    loadAgentDashboard("lead_gen", { installationId, decisionHref: (item) => workbenchHref("lead_gen", { tab: "comments", focus: item.id, installationId }) }),
    getLeadGenWorkbench(installation?.isMulti ? installationId : null),
  ]);
  return <LeadGenWorkbenchView data={data} dashboard={dashboard} initialTab={tab} focusId={focus} />;
};

export default WorkbenchLeadGen;
