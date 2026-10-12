"use client";

import { AgentDashboardFrame } from "@/features/agent-dashboard";
import { useT } from "@/i18n/client";
import { shifts as dict } from "@/i18n/dict/shifts";
import { workbenchFigures } from "@/i18n/dict/workbenchFigures";

/** STATE-8: the Shifts workbench with no data yet - the frame's own tree, the four figure terms and the manager's tab labels real, values and lists as skeleton. */
export const ShiftsWorkbenchLoading = () => {
  const t = useT(dict);
  const tf = useT(workbenchFigures);
  return (
    <AgentDashboardFrame
      module="shifts"
      isLoading
      figures={[
        { id: "week", term: tf("shWeek"), description: "" },
        { id: "gaps", term: tf("shGaps"), description: "" },
        { id: "leave", term: tf("shLeave"), description: "" },
        { id: "hours", term: tf("shHours"), description: "" },
      ]}
      tabs={[
        { id: "week", label: t("tabWeek") },
        { id: "requests", label: t("tabRequests") },
        { id: "setup", label: t("tabSetup") },
        { id: "quick", label: t("tabQuick") },
      ]}
    />
  );
};
