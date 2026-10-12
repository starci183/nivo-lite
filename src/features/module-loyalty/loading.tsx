"use client";

import { AgentDashboardFrame } from "@/features/agent-dashboard";
import { useT } from "@/i18n/client";
import { loyalty } from "@/i18n/dict/loyalty";

/** STATE-8: the Loyalty workbench with no data yet - the frame's own tree, the four figure terms and the five tab labels real, values and lists as skeleton. */
export const LoyaltyWorkbenchLoading = () => {
  const t = useT(loyalty);
  return (
    <AgentDashboardFrame
      module="loyalty"
      isLoading
      figures={[
        { id: "active", term: t("metricMembers"), description: "" },
        { id: "issued", term: t("metricIssued"), description: "" },
        { id: "redemptions", term: t("metricRedemptions"), description: "" },
        { id: "atRisk", term: t("metricAtRisk"), description: "" },
      ]}
      tabs={[
        { id: "overview", label: t("tab_overview") },
        { id: "members", label: t("tab_members") },
        { id: "rewards", label: t("tab_rewards") },
        { id: "promo", label: t("tab_promo") },
        { id: "pending", label: t("tab_pending") },
      ]}
    />
  );
};
