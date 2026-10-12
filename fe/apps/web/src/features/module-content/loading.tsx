"use client";

import { AgentDashboardFrame } from "@/features/agent-dashboard";
import { useT } from "@/i18n/client";
import { content } from "@/i18n/dict/content";
import { workbenchFigures } from "@/i18n/dict/workbenchFigures";

/** STATE-8: the Content workbench with no data yet - the frame's own tree, the four figure terms and the five tab labels real, values and lists as skeleton. */
export const ContentWorkbenchLoading = () => {
  const t = useT(content);
  const tf = useT(workbenchFigures);
  return (
    <AgentDashboardFrame
      module="content"
      isLoading
      figures={[
        { id: "waiting", term: tf("ctWaiting"), description: "" },
        { id: "published", term: tf("ctPublished"), description: "" },
        { id: "next", term: tf("ctNext"), description: "" },
        { id: "pillars", term: tf("ctPillars"), description: "" },
      ]}
      tabs={[
        { id: "calendar", label: t("tabCalendar") },
        { id: "list", label: t("tabList") },
        { id: "queue", label: t("tabQueue") },
        { id: "balance", label: t("tabBalance") },
        { id: "settings", label: t("tabSettings") },
      ]}
    />
  );
};
