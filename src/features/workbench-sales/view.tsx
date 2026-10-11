"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, DescriptionList, EmptyNotice, HorizontalScrollRegion, SurfaceCard, Tabs } from "@starci/grammar/common";
import { useLocale, useT } from "@/i18n/client";
import { workbenchSales } from "@/i18n/dict/workbenchSales";
import type { SalesWorkbenchData } from "@/lib/workbench-sales";
import { ActivityPanel } from "./activity";
import { AttentionPanel } from "./attention";
import { PAGE_CLASS_NAME, PANEL_CLASS_NAME } from "./classNames";
import { DecisionsPanel, decisionAnchor } from "./decisions";
import { formatVnd } from "./format";
import { HandoffsPanel } from "./handoffs";
import { PipelinePanel } from "./pipeline";

type TabId = "attention" | "pipeline" | "decisions" | "handoff" | "activity";
const TAB_IDS: ReadonlyArray<TabId> = ["attention", "pipeline", "decisions", "handoff", "activity"];
const isTab = (key: string | null | undefined): key is TabId => !!key && (TAB_IDS as ReadonlyArray<string>).includes(key);
const panelId = (key: string): string => `sales-panel-${key}`;

/** Props for {@link SalesWorkbenchView}. */
export type SalesWorkbenchViewProps = {
  readonly data: SalesWorkbenchData | null;
  /** The tab named in `?tab=`, already validated on the server. */
  readonly initialTab: string | null;
};

/** The Sales workbench: four honest figures, then five surfaces as tabs. */
export const SalesWorkbenchView = ({ data, initialTab }: SalesWorkbenchViewProps) => {
  const t = useT(workbenchSales);
  const locale = useLocale();
  const [tab, setTab] = useState<TabId>(isTab(initialTab) ? initialTab : "attention");
  const [focusId, setFocusId] = useState<string | null>(null);

  const select = useCallback((key: string) => {
    if (!isTab(key)) return;
    setTab(key);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", key);
      window.history.replaceState(null, "", url);
    } catch {
      // the address bar is a convenience only
    }
  }, []);

  // The route does not pass ?tab=, so read it once in the browser (after hydration, so server and client markup match).
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("tab");
    if (isTab(fromUrl)) setTab(fromUrl);
  }, []);

  const openDecision = useCallback((id: string) => {
    setFocusId(id);
    select("decisions");
  }, [select]);

  useEffect(() => {
    if (tab !== "decisions" || !focusId) return;
    const el = document.getElementById(decisionAnchor(focusId));
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [tab, focusId]);

  if (!data) {
    return (
      <div className={PAGE_CLASS_NAME}>
        <SurfaceCard ariaLabel={t("loadFailedTitle")}>
          <EmptyNotice message={t("loadFailedTitle")} description={t("loadFailedBody")} />
        </SurfaceCard>
      </div>
    );
  }

  const m = data.metrics;
  const count = (n: number): string => (n > 0 ? ` (${n})` : "");
  const items = [
    { id: "attention", label: `${t("tab_attention")}${count(data.attention.length)}` },
    { id: "pipeline", label: t("tab_pipeline") },
    { id: "decisions", label: `${t("tab_decisions")}${count(data.decisions.length)}` },
    { id: "handoff", label: t("tab_handoff") },
    { id: "activity", label: t("tab_activity") },
  ];

  return (
    <div className={PAGE_CLASS_NAME}>
      <SurfaceCard ariaLabel={t("metricsAria")}>
        <DescriptionList
          layout="stat-strip"
          isDivided
          items={[
            { id: "open", term: t("metricOpen"), description: String(m.openCount), meta: t("metricOpenBasis") },
            { id: "proposal", term: t("metricProposal"), description: formatVnd(m.proposalValueVnd, locale), meta: t("metricProposalBasis", { n: m.proposalCount }) },
            { id: "won", term: t("metricWon"), description: String(m.wonCount), meta: m.wonValueVnd > 0 ? t("metricWonBasis", { value: formatVnd(m.wonValueVnd, locale) }) : t("metricWonNoValue") },
            {
              id: "waiting",
              term: t("metricWaiting"),
              description: String(m.waitingCount),
              meta: m.waitingCount > 0 ? <Badge tone="warning" isDot>{t("metricWaitingBasis")}</Badge> : t("metricWaitingBasis"),
            },
          ]}
        />
      </SurfaceCard>

      <HorizontalScrollRegion overflow="needed" isFocusable={false}>
        <Tabs label={t("tabsLabel")} selectedKey={tab} items={items} inset="none" labelVisibility="always" panelId={panelId} onSelect={select} />
      </HorizontalScrollRegion>

      <div className={PANEL_CLASS_NAME} role="tabpanel" id={panelId(tab)}>
        {tab === "attention" ? <AttentionPanel rows={data.attention} nowIso={data.nowIso} onOpenDecision={openDecision} /> : null}
        {tab === "pipeline" ? <PipelinePanel deals={data.deals} closedHidden={data.closedHidden} /> : null}
        {tab === "decisions" ? <DecisionsPanel pending={data.decisions} decided={data.decided} nowIso={data.nowIso} focusId={focusId} /> : null}
        {tab === "handoff" ? <HandoffsPanel rows={data.handoffs} /> : null}
        {tab === "activity" ? <ActivityPanel rows={data.activity} /> : null}
      </div>
    </div>
  );
};
