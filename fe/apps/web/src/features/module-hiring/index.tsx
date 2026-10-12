import { EmptyNotice, SurfaceCard } from "@starci/grammar/common";
import { AgentDashboardFrame } from "@/features/agent-dashboard";
import { getT } from "@/i18n/server";
import { workbenchFigures } from "@/i18n/dict/workbenchFigures";
import { loadAgentDashboard } from "@/lib/agent-dashboard";
import { workbenchHref } from "@/lib/agent-dashboard-shared";
import { getHiringWorkbench, type HiringWorkbenchData } from "@/lib/module-hiring-queries";
import { HiringWorkbenchView } from "./view";
import { PAGE_CLASS_NAME } from "./classNames";

/** Props for {@link WorkbenchHiring}. */
export type HiringWorkbenchProps = {
  /** `?tab=` from the route (jobs, candidates, interviews, offers, onboarding, settings); anything else opens the first tab. */
  readonly tab?: string | null;
};

/**
 * Connected Hiring workbench (/agents/hiring/workbench): the agent dashboard frame around the six Hiring surfaces. Reads with the signed-in manager's own client
 * and still renders if the tables are not ready. A non-manager gets the access notice alone: candidate files are personal data, so the frame's lists are not read for them.
 */
const WorkbenchHiring = async ({ tab = null }: HiringWorkbenchProps = {}) => {
  const t = await getT(workbenchFigures);
  let data: HiringWorkbenchData | null = null;
  let failed = false;
  try {
    data = await getHiringWorkbench();
  } catch (e) {
    failed = true;
    console.error("hiring workbench failed", e instanceof Error ? e.message : e);
  }
  if (data === null && !failed) {
    return (
      <div className={PAGE_CLASS_NAME}>
        <SurfaceCard ariaLabel={t("hrForbiddenTitle")}>
          <EmptyNotice message={t("hrForbiddenTitle")} description={t("hrForbiddenBody")} />
        </SurfaceCard>
      </div>
    );
  }
  // A "Chờ bạn" row of Hiring is an offer or a hiring step: the Offers tab is where the existing decide UI renders it.
  const dashboard = await loadAgentDashboard("hiring", { decisionHref: (item) => workbenchHref("hiring", { tab: "offers", focus: item.id }) });
  if (data === null) {
    return (
      <AgentDashboardFrame
        module="hiring"
        data={dashboard}
        figures={[]}
        figuresFailed
        tabs={[{
          id: "jobs",
          label: t("hrTabJobs"),
          content: (
            <SurfaceCard ariaLabel={t("hrFailedTitle")}>
              <EmptyNotice message={t("hrFailedTitle")} description={t("hrFailedBody")} />
            </SurfaceCard>
          ),
        }]}
      />
    );
  }
  return <HiringWorkbenchView data={data} dashboard={dashboard} initialTab={tab} />;
};

export default WorkbenchHiring;
