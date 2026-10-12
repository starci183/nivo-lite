"use client";

import { AgentDashboardFrame } from "@/features/agent-dashboard";
import { useT } from "@/i18n/client";
import { workbenchLeadGen } from "@/i18n/dict/workbenchLeadGen";
import type { AgentDashboardData } from "@/lib/agent-dashboard-shared";
import type { LeadGenWorkbenchData } from "@/lib/workbench-lead-gen";
import { CommentsPanel } from "./comments";
import { HandoffsPanel } from "./handoffs";
import { LeadsPanel } from "./leads";
import { SourcesPanel } from "./sources";

/** Props for {@link LeadGenWorkbenchView}. */
export type LeadGenWorkbenchViewProps = {
  readonly data: LeadGenWorkbenchData;
  /** The frame's common regions (waiting, done, connections, knowledge), loaded on the server. */
  readonly dashboard: AgentDashboardData;
  /** The tab named in `?tab=`, already read on the server. */
  readonly initialTab: string | null;
  /** The work item named in `?focus=`: with no `?tab=`, the Comments tab opens. */
  readonly focusId?: string | null;
};

/** The Lead Gen workbench: the agent dashboard frame (four figures, waiting, done, connections, knowledge) around four areas as primary tabs. */
export const LeadGenWorkbenchView = ({ data, dashboard, initialTab, focusId = null }: LeadGenWorkbenchViewProps) => {
  const t = useT(workbenchLeadGen);
  const m = data.metrics;
  const count = (n: number): string => (n > 0 ? ` (${n})` : "");
  return (
    <AgentDashboardFrame
      module="lead_gen"
      data={dashboard}
      initialTab={initialTab ?? (focusId ? "comments" : null)}
      figures={[
        { id: "newToday", term: t("figNewToday"), description: String(m.newToday), meta: t("figNewTodayBasis") },
        { id: "hotWaiting", term: t("figHotWaiting"), description: String(m.hotWaiting), meta: t("figHotWaitingBasis") },
        {
          id: "firstReply",
          term: t("figFirstReply"),
          description: m.firstReplyP50Min === null ? "—" : String(m.firstReplyP50Min),
          unit: m.firstReplyP50Min === null ? undefined : t("figFirstReplyUnit"),
          meta: m.firstReplyP50Min === null ? t("figFirstReplyNone") : t("figFirstReplyBasis", { n: m.firstReplySample }),
        },
        {
          id: "conversion",
          term: t("figConversion"),
          description: m.conversionLeads === 0 ? "—" : `${Math.round((m.conversionWon / m.conversionLeads) * 100)}%`,
          meta: m.conversionLeads === 0 ? t("figConversionNone", { days: m.conversionWindowDays }) : t("figConversionBasis", { won: m.conversionWon, leads: m.conversionLeads, days: m.conversionWindowDays }),
        },
      ]}
      tabs={[
        { id: "leads", label: t("tabLeads"), content: <LeadsPanel rows={data.leads} hidden={data.leadsHidden} /> },
        { id: "sources", label: t("tabSources"), content: <SourcesPanel rows={data.sources} /> },
        { id: "comments", label: `${t("tabComments")}${count(data.comments.length)}`, content: <CommentsPanel rows={data.comments} /> },
        { id: "handoffs", label: t("tabHandoffs"), content: <HandoffsPanel rows={data.handoffs} /> },
      ]}
    />
  );
};
