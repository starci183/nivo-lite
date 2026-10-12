"use client";

import { AgentDashboardFrame } from "@/features/agent-dashboard";
import { useT } from "@/i18n/client";
import { workbenchAccounting } from "@/i18n/dict/workbenchAccounting";

/** STATE-8: the Accounting workbench with no data yet - the frame's own tree, the four figure terms and the four tab labels real, values and lists as skeleton. */
export const AccountingWorkbenchLoading = () => {
  const t = useT(workbenchAccounting);
  return (
    <AgentDashboardFrame
      module="accounting"
      isLoading
      figures={[
        { id: "income", term: t("mIncome"), description: "" },
        { id: "receivable", term: t("mReceivable"), description: "" },
        { id: "unmatched", term: t("mUnmatched"), description: "" },
        { id: "ageing", term: t("mAgeing"), description: "" },
      ]}
      tabs={[
        { id: "overview", label: t("tabOverview") },
        { id: "evidence", label: t("tabEvidence") },
        { id: "questions", label: t("tabQuestions") },
        { id: "ledger", label: t("tabLedger") },
      ]}
    />
  );
};
