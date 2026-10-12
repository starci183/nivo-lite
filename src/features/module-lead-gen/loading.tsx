"use client";

import { AgentDashboardFrame } from "@/features/agent-dashboard";
import { useT } from "@/i18n/client";
import { workbenchLeadGen } from "@/i18n/dict/workbenchLeadGen";

/** STATE-8: the Lead Gen workbench with no data yet - the frame's own tree, the four figure terms and the four tab labels real, values and lists as skeleton. */
export const LeadGenWorkbenchLoading = () => {
  const t = useT(workbenchLeadGen);
  return (
    <AgentDashboardFrame
      module="lead_gen"
      isLoading
      figures={[
        { id: "newToday", term: t("figNewToday"), description: "" },
        { id: "hotWaiting", term: t("figHotWaiting"), description: "" },
        { id: "firstReply", term: t("figFirstReply"), description: "" },
        { id: "conversion", term: t("figConversion"), description: "" },
      ]}
      tabs={[
        { id: "leads", label: t("tabLeads") },
        { id: "sources", label: t("tabSources") },
        { id: "comments", label: t("tabComments") },
        { id: "handoffs", label: t("tabHandoffs") },
      ]}
    />
  );
};
