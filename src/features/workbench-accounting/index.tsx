import { EmptyNotice, SurfaceCard } from "@starci/grammar/common";
import { AgentDashboardFrame } from "@/features/agent-dashboard";
import { getT } from "@/i18n/server";
import { workbenchAccounting } from "@/i18n/dict/workbenchAccounting";
import { loadAgentDashboard } from "@/lib/agent-dashboard";
import { workbenchHref } from "@/lib/agent-dashboard-shared";
import { getAccountingWorkbench, type AccountingWorkbench } from "@/lib/workbench-accounting";
import { AccountingWorkbenchView } from "./component";

/** Props for {@link Workbench}. */
export type AccountingWorkbenchProps = {
  /** `?tab=` from the route (overview, evidence, questions, ledger); anything else opens the first tab. */
  readonly tab?: string | null;
};

/** Accounting workbench slot of /m/accounting/workbench: the agent dashboard frame around the four Accounting surfaces. */
const Workbench = async ({ tab = null }: AccountingWorkbenchProps = {}) => {
  const t = await getT(workbenchAccounting);
  // Every waiting accounting item is a "question": a "Chờ bạn" row opens the Questions tab, where the existing decide UI renders it.
  const dashboard = loadAgentDashboard("accounting", { decisionHref: (item) => workbenchHref("accounting", { tab: "questions", focus: item.id }) });
  let data: AccountingWorkbench | null = null;
  try {
    data = await getAccountingWorkbench();
  } catch {
    data = null;
  }
  if (data === null) {
    return (
      <AgentDashboardFrame
        module="accounting"
        data={await dashboard}
        figures={[]}
        figuresFailed
        tabs={[{
          id: "overview",
          label: t("tabOverview"),
          content: (
            <SurfaceCard ariaLabel={t("loadFailedTitle")}>
              <EmptyNotice message={t("loadFailedTitle")} description={t("loadFailedBody")} />
            </SurfaceCard>
          ),
        }]}
      />
    );
  }
  return <AccountingWorkbenchView data={data} dashboard={await dashboard} initialTab={tab} />;
};

export default Workbench;
