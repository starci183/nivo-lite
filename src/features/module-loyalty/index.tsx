import { loadAgentDashboard } from "@/lib/agent-dashboard";
import { workbenchHref } from "@/lib/agent-dashboard-shared";
import { getLoyaltyWorkbench, type LoyaltyWorkbenchData } from "@/lib/module-loyalty-queries";
import { loyaltyFigures } from "@/lib/workbench-loyalty";
import { LoyaltyWorkbenchView } from "./view";

/** Props for {@link WorkbenchLoyalty}. */
export type LoyaltyWorkbenchProps = {
  /** `?tab=` from the route (overview, members, rewards, promo, pending); anything else opens the first tab. */
  readonly tab?: string | null;
};

/** Connected loyalty workbench: the agent dashboard frame around the programme data; it still renders if the tables are not ready. */
const WorkbenchLoyalty = async ({ tab = null }: LoyaltyWorkbenchProps = {}) => {
  // Every waiting loyalty item is an approval of the "Chờ duyệt" tab, where the existing decide UI renders it.
  const dashboard = loadAgentDashboard("loyalty", { decisionHref: (item) => workbenchHref("loyalty", { tab: "pending", focus: item.id }) });
  let data: LoyaltyWorkbenchData | null = null;
  try {
    data = await getLoyaltyWorkbench();
  } catch (e) {
    console.error("loyalty workbench failed", e instanceof Error ? e.message : e);
  }
  return <LoyaltyWorkbenchView data={data} figures={data ? loyaltyFigures(data) : null} dashboard={await dashboard} initialTab={tab} />;
};

export default WorkbenchLoyalty;
