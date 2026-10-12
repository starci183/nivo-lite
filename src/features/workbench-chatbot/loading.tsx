"use client";

import { AgentDashboardFrame } from "@/features/agent-dashboard";
import { useT } from "@/i18n/client";
import { workbenchChatbot } from "@/i18n/dict/workbenchChatbot";

/** STATE-8: the Chatbot workbench with no data yet - the frame's own tree, the four figure terms and the tab label real, values and lists as skeleton. */
export const ChatbotWorkbenchLoading = () => {
  const t = useT(workbenchChatbot);
  return (
    <AgentDashboardFrame
      module="chatbot"
      isLoading
      figures={[
        { id: "today", term: t("metricToday"), description: "" },
        { id: "waiting", term: t("metricWaiting"), description: "" },
        { id: "response", term: t("metricResponse"), description: "" },
        { id: "leads", term: t("metricLeads"), description: "" },
      ]}
      tabs={[{ id: "inbox", label: t("title") }]}
    />
  );
};
