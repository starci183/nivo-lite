"use client";

import { AgentDashboardFrame } from "@/features/agent-dashboard";
import { useT } from "@/i18n/client";
import { workbenchSales } from "@/i18n/dict/workbenchSales";

/** STATE-8: the Sales workbench with no data yet - the frame's own tree, the four figure terms and the five tab labels real, values and lists as skeleton. */
export const SalesWorkbenchLoading = () => {
  const t = useT(workbenchSales);
  return (
    <AgentDashboardFrame
      module="sales"
      isLoading
      figures={[
        { id: "open", term: t("metricOpen"), description: "" },
        { id: "proposal", term: t("metricProposal"), description: "" },
        { id: "won", term: t("metricWon"), description: "" },
        { id: "conversion", term: t("metricConversion"), description: "" },
      ]}
      tabs={[
        { id: "attention", label: t("tab_attention") },
        { id: "pipeline", label: t("tab_pipeline") },
        { id: "decisions", label: t("tab_decisions") },
        { id: "handoff", label: t("tab_handoff") },
        { id: "contracts", label: t("tab_contracts") },
        { id: "activity", label: t("tab_activity") },
      ]}
    />
  );
};
