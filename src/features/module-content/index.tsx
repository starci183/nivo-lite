import { EmptyNotice, SurfaceCard } from "@starci/grammar/common";
import { AgentDashboardFrame } from "@/features/agent-dashboard";
import { getT } from "@/i18n/server";
import { content } from "@/i18n/dict/content";
import { loadAgentDashboard } from "@/lib/agent-dashboard";
import { workbenchHref } from "@/lib/agent-dashboard-shared";
import { getContentWorkbench, type ContentWorkbenchData } from "@/lib/module-content-data";
import { ContentWorkbenchView } from "./view";

/** Props for {@link WorkbenchContent}. */
export type ContentWorkbenchProps = {
  /** `?tab=` from the route (calendar, list, queue, balance, settings); anything else opens the first tab. */
  readonly tab?: string | null;
};

/** Connected Content workbench (/agents/content/workbench): the agent dashboard frame around the five Content surfaces. Reads with the member's session and still renders if the tables are not ready. */
const WorkbenchContent = async ({ tab = null }: ContentWorkbenchProps = {}) => {
  const t = await getT(content);
  // Every waiting content item is a post to approve: a "Chờ bạn" row opens the Approvals tab, where the existing decide UI renders it.
  const dashboard = loadAgentDashboard("content", { decisionHref: (item) => workbenchHref("content", { tab: "queue", focus: item.id }) });
  let data: ContentWorkbenchData | null = null;
  try {
    data = await getContentWorkbench();
  } catch (e) {
    console.error("content workbench failed", e instanceof Error ? e.message : e);
  }
  if (data === null) {
    return (
      <AgentDashboardFrame
        module="content"
        data={await dashboard}
        figures={[]}
        figuresFailed
        tabs={[{
          id: "calendar",
          label: t("tabCalendar"),
          content: (
            <SurfaceCard ariaLabel={t("loadFailedTitle")}>
              <EmptyNotice message={t("loadFailedTitle")} description={t("loadFailedBody")} />
            </SurfaceCard>
          ),
        }]}
      />
    );
  }
  return <ContentWorkbenchView data={data} dashboard={await dashboard} initialTab={tab} />;
};

export default WorkbenchContent;
