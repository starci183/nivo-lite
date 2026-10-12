"use client";

import { useCallback, useEffect, useState } from "react";
import { EmptyNotice, SurfaceCard } from "@starci/grammar/common";
import { AgentDashboardFrame } from "@/features/agent-dashboard";
import { useLocale, useT } from "@/i18n/client";
import { workbenchSales } from "@/i18n/dict/workbenchSales";
import type { AgentDashboardData } from "@/lib/agent-dashboard-shared";
import type { SalesConversion, SalesWorkbenchData } from "@/lib/workbench-sales";
import { ActivityPanel } from "./activity";
import { AttentionPanel } from "./attention";
import { ContractsPanel } from "./contracts";
import { DecisionsPanel, decisionAnchor } from "./decisions";
import { formatVnd } from "./format";
import { HandoffsPanel } from "./handoffs";
import { PipelinePanel } from "./pipeline";

type TabId = "attention" | "pipeline" | "decisions" | "handoff" | "contracts" | "activity";
const TAB_IDS: ReadonlyArray<TabId> = ["attention", "pipeline", "decisions", "handoff", "contracts", "activity"];
const isTab = (key: string | null | undefined): key is TabId => !!key && (TAB_IDS as ReadonlyArray<string>).includes(key);

const SOURCE_KEYS = ["telegram", "zalo", "website", "facebook", "email", "phone", "manual", "bank"] as const;
type SourceKey = (typeof SOURCE_KEYS)[number];
const isSourceKey = (key: string): key is SourceKey => (SOURCE_KEYS as ReadonlyArray<string>).includes(key);
const MAX_SOURCES_SHOWN = 3;
const percent = (won: number, leads: number): string => `${Math.round((won / Math.max(1, leads)) * 100)}%`;

/** Props for {@link SalesWorkbenchView}. */
export type SalesWorkbenchViewProps = {
  readonly data: SalesWorkbenchData | null;
  /** The frame's common regions (waiting, done, connections, knowledge), loaded on the server. */
  readonly dashboard: AgentDashboardData;
  /** The tab named in `?tab=`, already read on the server. */
  readonly initialTab: string | null;
  /** The decision named in `?focus=`: the Decisions tab scrolls to it. */
  readonly initialFocus: string | null;
};

/** The Sales workbench: the agent dashboard frame (four figures, waiting, done, connections, knowledge) around the six Sales surfaces as tabs. */
export const SalesWorkbenchView = ({ data, dashboard, initialTab, initialFocus }: SalesWorkbenchViewProps) => {
  const t = useT(workbenchSales);
  const locale = useLocale();
  const [tab, setTab] = useState<TabId>(isTab(initialTab) ? initialTab : initialFocus ? "decisions" : "attention");
  const [focusId, setFocusId] = useState<string | null>(initialFocus);

  const select = useCallback((key: string) => {
    if (isTab(key)) setTab(key);
  }, []);

  const openDecision = useCallback((id: string) => {
    setFocusId(id);
    setTab("decisions");
  }, []);

  useEffect(() => {
    if (tab !== "decisions" || !focusId) return;
    const el = document.getElementById(decisionAnchor(focusId));
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [tab, focusId]);

  if (!data) {
    return (
      <AgentDashboardFrame
        module="sales"
        data={dashboard}
        figures={[]}
        figuresFailed
        tabs={[{
          id: "attention",
          label: t("tab_attention"),
          content: (
            <SurfaceCard ariaLabel={t("loadFailedTitle")}>
              <EmptyNotice message={t("loadFailedTitle")} description={t("loadFailedBody")} />
            </SurfaceCard>
          ),
        }]}
      />
    );
  }

  const m = data.metrics;
  const count = (n: number): string => (n > 0 ? ` (${n})` : "");
  const sourceName = (source: string): string => t(`source_${isSourceKey(source) ? source : "other"}`);
  const conversionMeta = (c: SalesConversion): string =>
    c.leads === 0
      ? t("metricConversionNone", { days: c.windowDays })
      : t("metricConversionSources", { days: c.windowDays, sources: c.sources.slice(0, MAX_SOURCES_SHOWN).map((s) => `${sourceName(s.source)} ${percent(s.won, s.leads)} (${s.won}/${s.leads})`).join(" · ") });

  return (
    <AgentDashboardFrame
      module="sales"
      data={dashboard}
      figures={[
        { id: "open", term: t("metricOpen"), description: String(m.openCount), meta: t("metricOpenBasis") },
        { id: "proposal", term: t("metricProposal"), description: formatVnd(m.proposalValueVnd, locale), meta: t("metricProposalBasis", { n: m.proposalCount }) },
        { id: "won", term: t("metricWon"), description: String(m.wonCount), meta: m.wonValueVnd > 0 ? t("metricWonBasis", { value: formatVnd(m.wonValueVnd, locale) }) : t("metricWonNoValue") },
        {
          id: "conversion",
          term: t("metricConversion"),
          description: m.conversion.leads === 0 ? "—" : percent(m.conversion.won, m.conversion.leads),
          meta: conversionMeta(m.conversion),
        },
      ]}
      tab={tab}
      onTabChange={select}
      tabs={[
        { id: "attention", label: `${t("tab_attention")}${count(data.attention.length)}`, content: <AttentionPanel rows={data.attention} nowIso={data.nowIso} onOpenDecision={openDecision} /> },
        { id: "pipeline", label: t("tab_pipeline"), content: <PipelinePanel deals={data.deals} closedHidden={data.closedHidden} /> },
        { id: "decisions", label: `${t("tab_decisions")}${count(data.decisions.length)}`, content: <DecisionsPanel pending={data.decisions} decided={data.decided} nowIso={data.nowIso} focusId={focusId} /> },
        { id: "handoff", label: t("tab_handoff"), content: <HandoffsPanel rows={data.handoffs} /> },
        { id: "contracts", label: t("tab_contracts"), content: <ContractsPanel contracts={data.contracts} leads={data.leadOptions} nowIso={data.nowIso} /> },
        { id: "activity", label: t("tab_activity"), content: <ActivityPanel rows={data.activity} /> },
      ]}
    />
  );
};
