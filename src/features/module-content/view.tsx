"use client";

import { useMemo, useState } from "react";
import { Alert, Button, Text, type DescriptionListStatItem } from "@starci/grammar/common";
import { AgentDashboardFrame, formatWhen } from "@/features/agent-dashboard";
import { useLocale, useT } from "@/i18n/client";
import { content } from "@/i18n/dict/content";
import { workbenchFigures } from "@/i18n/dict/workbenchFigures";
import type { AgentDashboardData } from "@/lib/agent-dashboard-shared";
import type { ContentWorkbenchData } from "@/lib/module-content-data";
import { pad2, vnParts } from "@/lib/module-content-shared";
import { BalancePanel } from "./balance";
import { MonthCalendar } from "./calendar";
import { AddDialog, PlanDialog, QuickDialog } from "./dialogs";
import { ItemEditor } from "./editor";
import { PANEL_CLASS_NAME, TOOLBAR_CLASS_NAME } from "./classNames";
import { ListPanel } from "./list";
import { QueuePanel } from "./queue";
import { SettingsPanel } from "./settings";

type TabId = "calendar" | "list" | "queue" | "balance" | "settings";
const TAB_IDS: ReadonlyArray<TabId> = ["calendar", "list", "queue", "balance", "settings"];
const isTab = (k: string | null | undefined): k is TabId => !!k && (TAB_IDS as ReadonlyArray<string>).includes(k);

export type ContentWorkbenchViewProps = {
  readonly data: ContentWorkbenchData;
  /** The frame's common regions (waiting, done, connections, knowledge), loaded on the server. */
  readonly dashboard: AgentDashboardData;
  /** The tab named in `?tab=`, already read on the server. */
  readonly initialTab: string | null;
};

/**
 * The Content workbench: the agent dashboard frame (four figures, waiting, done, connections, knowledge) around calendar / list / approvals / balance / settings,
 * with "Plan the month" as the page command and the item editor and dialogs on top.
 */
export const ContentWorkbenchView = ({ data, dashboard, initialTab }: ContentWorkbenchViewProps) => {
  const t = useT(content);
  const tf = useT(workbenchFigures);
  const locale = useLocale();
  const [tab, setTab] = useState<TabId>(isTab(initialTab) ? initialTab : "calendar");
  const now = useMemo(() => new Date(data.nowIso), [data.nowIso]);
  const here = vnParts(now);
  const [ym, setYm] = useState<{ y: number; m: number }>({ y: here.y, m: here.m });
  const [openId, setOpenId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"plan" | "quick" | "add" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const items = data.items;
  const waiting = items.filter((i) => i.status === "waiting_approval");
  const ready = items.filter((i) => i.status === "approved");
  const hasSetup = data.pillars.some((p) => p.active) && data.cadence.some((c) => c.posts_per_week > 0);
  const opened = openId ? items.find((i) => i.id === openId) ?? null : null;
  const count = (n: number): string => (n > 0 ? ` (${n})` : "");
  const shiftMonth = (d: number) => setYm(({ y, m }) => { const x = new Date(Date.UTC(y, m - 1 + d, 1)); return { y: x.getUTCFullYear(), m: x.getUTCMonth() + 1 }; });
  const lastPlan = data.lastPlan ? t("planLast", { n: data.lastPlan.ideas, month: data.lastPlan.month.slice(0, 7).split("-").reverse().join("/"), s: Math.round((data.lastPlan.ms ?? 0) / 1000) }) : null;

  const f = data.figures;
  const ribbon: ReadonlyArray<DescriptionListStatItem> = f
    ? [
      { id: "waiting", term: tf("ctWaiting"), description: String(f.awaitingApproval), meta: tf("ctWaitingMeta") },
      { id: "published", term: tf("ctPublished"), description: String(f.published30), meta: tf("ctPublishedMeta") },
      f.next
        ? { id: "next", term: tf("ctNext"), description: formatWhen(f.next.at, locale), meta: f.next.title }
        : { id: "next", term: tf("ctNext"), description: "—", meta: tf("ctNextNoneMeta") },
      f.pillars.total > 0
        ? { id: "pillars", term: tf("ctPillars"), description: `${f.pillars.covered}/${f.pillars.total}`, meta: tf("ctPillarsMeta") }
        : { id: "pillars", term: tf("ctPillars"), description: "—", meta: tf("ctPillarsNone") },
    ]
    : [];

  /** Quick idea and Add a post: secondary commands of the calendar and the list (the primary command, Plan the month, is the page's). */
  const actions = data.canManage ? (
    <div className={TOOLBAR_CLASS_NAME}>
      <Button variant="secondary" onPress={() => setDialog("quick")}>{t("quickIdea")}</Button>
      <Button variant="outline" onPress={() => setDialog("add")}>{t("addPost")}</Button>
    </div>
  ) : null;

  const monthBar = (
    <div className={TOOLBAR_CLASS_NAME}>
      <Button variant="outline" size="sm" onPress={() => shiftMonth(-1)}>{t("prevMonth")}</Button>
      <Text weight="semibold">{t("monthTitle", { m: pad2(ym.m), y: ym.y })}</Text>
      <Button variant="outline" size="sm" onPress={() => shiftMonth(1)}>{t("nextMonth")}</Button>
      <Button variant="ghost" size="sm" onPress={() => setYm({ y: here.y, m: here.m })}>{t("today")}</Button>
    </div>
  );

  return (
    <>
      <AgentDashboardFrame
        module="content"
        data={dashboard}
        figures={ribbon}
        figuresFailed={f === null}
        command={data.canManage ? <Button variant="primary" onPress={() => setDialog("plan")}>{t("planMonth")}</Button> : undefined}
        tab={tab}
        onTabChange={(key) => { if (isTab(key)) setTab(key); }}
        tabs={[
          {
            id: "calendar",
            label: t("tabCalendar"),
            content: (
              <div className={PANEL_CLASS_NAME}>
                {error ? <Alert tone="negative" title={error} dismissLabel={t("close")} onDismiss={() => setError(null)} /> : null}
                {actions}
                {monthBar}
                <MonthCalendar items={items} pillars={data.pillars} y={ym.y} m={ym.m} nowIso={data.nowIso} canManage={data.canManage} onOpen={setOpenId} onError={setError} hasSetup={hasSetup} onOpenSettings={() => setTab("settings")} />
              </div>
            ),
          },
          {
            id: "list",
            label: t("tabList"),
            content: (
              <div className={PANEL_CLASS_NAME}>
                {actions}
                <ListPanel items={items} pillars={data.pillars} onOpen={setOpenId} />
              </div>
            ),
          },
          { id: "queue", label: `${t("tabQueue")}${count(waiting.length)}`, content: <QueuePanel waiting={waiting} ready={ready} onOpen={setOpenId} /> },
          {
            id: "balance",
            label: t("tabBalance"),
            content: (
              <div className={PANEL_CLASS_NAME}>
                {monthBar}
                <BalancePanel items={items} pillars={data.pillars} cadence={data.cadence} y={ym.y} m={ym.m} />
              </div>
            ),
          },
          { id: "settings", label: t("tabSettings"), content: <SettingsPanel pillars={data.pillars} cadence={data.cadence} settings={data.settings} canManage={data.canManage} /> },
        ]}
      />
      {dialog === "plan" ? <PlanDialog y={ym.y} m={ym.m} lastPlan={lastPlan} onClose={() => setDialog(null)} /> : null}
      {dialog === "quick" ? <QuickDialog defaultChannels={data.cadence.filter((c) => c.posts_per_week > 0).map((c) => c.channel)} onClose={() => setDialog(null)} onOpenItem={setOpenId} /> : null}
      {dialog === "add" ? <AddDialog pillars={data.pillars} onClose={() => setDialog(null)} onOpenItem={setOpenId} /> : null}
      {opened ? <ItemEditor key={`${opened.id}:${opened.status}:${opened.drafted_at ?? ""}`} item={opened} data={data} onClose={() => setOpenId(null)} /> : null}
    </>
  );
};
