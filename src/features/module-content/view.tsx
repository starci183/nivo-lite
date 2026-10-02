"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Button, EmptyNotice, SurfaceCard, Tabs, Text } from "@starci/grammar/common";
import { useT } from "@/i18n/client";
import { content } from "@/i18n/dict/content";
import type { ContentWorkbenchData } from "@/lib/module-content-data";
import { pad2, vnDateKey, vnParts, weekStartKey } from "@/lib/module-content-shared";
import { BalancePanel } from "./balance";
import { MonthCalendar } from "./calendar";
import { AddDialog, PlanDialog, QuickDialog } from "./dialogs";
import { ItemEditor } from "./editor";
import { METRIC_ALERT_CLASS_NAME, METRIC_CLASS_NAME, METRICS_CLASS_NAME, PAGE_CLASS_NAME, PANEL_CLASS_NAME, TABS_CLASS_NAME, TOOLBAR_CLASS_NAME } from "./classNames";
import { ListPanel } from "./list";
import { QueuePanel } from "./queue";
import { SettingsPanel } from "./settings";

type TabId = "calendar" | "list" | "queue" | "balance" | "settings";
const TAB_IDS: ReadonlyArray<TabId> = ["calendar", "list", "queue", "balance", "settings"];
const isTab = (k: string | null | undefined): k is TabId => !!k && (TAB_IDS as ReadonlyArray<string>).includes(k);
const panelId = (k: string): string => `content-panel-${k}`;

const Metric = ({ label, value, basis, isAlert = false }: { readonly label: string; readonly value: string; readonly basis: string; readonly isAlert?: boolean }) => (
  <div className={isAlert ? `${METRIC_CLASS_NAME} ${METRIC_ALERT_CLASS_NAME}` : METRIC_CLASS_NAME}>
    <Text size="xs" tone="muted" weight="medium">{label}</Text>
    <Text size="metric-lead" weight="semibold">{value}</Text>
    <Text size="xs" tone="muted">{basis}</Text>
  </div>
);

export type ContentWorkbenchViewProps = { readonly data: ContentWorkbenchData | null; readonly initialTab: string | null };

/** The Content workbench: four figures, the actions (plan, quick idea, add), then calendar / list / approvals / balance / settings, and the item editor. */
export const ContentWorkbenchView = ({ data, initialTab }: ContentWorkbenchViewProps) => {
  const t = useT(content);
  const [tab, setTab] = useState<TabId>(isTab(initialTab) ? initialTab : "calendar");
  const now = useMemo(() => (data ? new Date(data.nowIso) : new Date()), [data]);
  const here = vnParts(now);
  const [ym, setYm] = useState<{ y: number; m: number }>({ y: here.y, m: here.m });
  const [openId, setOpenId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"plan" | "quick" | "add" | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("tab");
    if (isTab(fromUrl)) setTab(fromUrl);
  }, []);

  if (!data) {
    return (
      <div className={PAGE_CLASS_NAME}>
        <SurfaceCard ariaLabel={t("loadFailedTitle")}>
          <EmptyNotice message={t("loadFailedTitle")} description={t("loadFailedBody")} />
        </SurfaceCard>
      </div>
    );
  }

  const items = data.items;
  const week = weekStartKey(now);
  const today = vnDateKey(now);
  const inThisWeek = items.filter((i) => i.scheduled_at && i.status !== "skipped" && weekStartKey(new Date(i.scheduled_at)) === week).length;
  const waiting = items.filter((i) => i.status === "waiting_approval");
  const ready = items.filter((i) => i.status === "approved");
  const dueToday = items.filter((i) => i.scheduled_at && vnDateKey(new Date(i.scheduled_at)) === today && i.status !== "published" && i.status !== "skipped").length;
  const hasSetup = data.pillars.some((p) => p.active) && data.cadence.some((c) => c.posts_per_week > 0);
  const opened = openId ? items.find((i) => i.id === openId) ?? null : null;
  const count = (n: number): string => (n > 0 ? ` (${n})` : "");
  const shiftMonth = (d: number) => setYm(({ y, m }) => { const x = new Date(Date.UTC(y, m - 1 + d, 1)); return { y: x.getUTCFullYear(), m: x.getUTCMonth() + 1 }; });
  const lastPlan = data.lastPlan ? t("planLast", { n: data.lastPlan.ideas, month: data.lastPlan.month.slice(0, 7).split("-").reverse().join("/"), s: Math.round((data.lastPlan.ms ?? 0) / 1000) }) : null;

  const tabs = [
    { id: "calendar", label: t("tabCalendar") },
    { id: "list", label: t("tabList") },
    { id: "queue", label: `${t("tabQueue")}${count(waiting.length)}` },
    { id: "balance", label: t("tabBalance") },
    { id: "settings", label: t("tabSettings") },
  ];

  return (
    <div className={PAGE_CLASS_NAME}>
      <div className={METRICS_CLASS_NAME} role="group" aria-label={t("metricsAria")}>
        <Metric label={t("mWeek")} value={String(inThisWeek)} basis={t("mWeekBasis")} />
        <Metric label={t("mWaiting")} value={String(waiting.length)} basis={t("mWaitingBasis")} isAlert={waiting.length > 0} />
        <Metric label={t("mReady")} value={String(ready.length)} basis={t("mReadyBasis")} />
        <Metric label={t("mToday")} value={String(dueToday)} basis={t("mTodayBasis")} />
      </div>

      {data.canManage ? (
        <div className={TOOLBAR_CLASS_NAME}>
          <Button variant="primary" onPress={() => setDialog("plan")}>{t("planMonth")}</Button>
          <Button variant="secondary" onPress={() => setDialog("quick")}>{t("quickIdea")}</Button>
          <Button variant="outline" onPress={() => setDialog("add")}>{t("addPost")}</Button>
        </div>
      ) : null}

      {error ? <Alert tone="negative" title={error} dismissLabel={t("close")} onDismiss={() => setError(null)} /> : null}

      <div className={TABS_CLASS_NAME}>
        <Tabs label={t("tabsLabel")} selectedKey={tab} items={tabs} inset="none" labelVisibility="always" panelId={panelId} onSelect={select} />
      </div>

      <div className={PANEL_CLASS_NAME} role="tabpanel" id={panelId(tab)}>
        {tab === "calendar" || tab === "balance" ? (
          <div className={TOOLBAR_CLASS_NAME}>
            <Button variant="outline" size="sm" onPress={() => shiftMonth(-1)}>{t("prevMonth")}</Button>
            <Text weight="semibold">{t("monthTitle", { m: pad2(ym.m), y: ym.y })}</Text>
            <Button variant="outline" size="sm" onPress={() => shiftMonth(1)}>{t("nextMonth")}</Button>
            <Button variant="ghost" size="sm" onPress={() => setYm({ y: here.y, m: here.m })}>{t("today")}</Button>
          </div>
        ) : null}
        {tab === "calendar" ? <MonthCalendar items={items} pillars={data.pillars} y={ym.y} m={ym.m} nowIso={data.nowIso} canManage={data.canManage} onOpen={setOpenId} onError={setError} hasSetup={hasSetup} onOpenSettings={() => select("settings")} /> : null}
        {tab === "list" ? <ListPanel items={items} pillars={data.pillars} onOpen={setOpenId} /> : null}
        {tab === "queue" ? <QueuePanel waiting={waiting} ready={ready} onOpen={setOpenId} /> : null}
        {tab === "balance" ? <BalancePanel items={items} pillars={data.pillars} cadence={data.cadence} y={ym.y} m={ym.m} /> : null}
        {tab === "settings" ? <SettingsPanel pillars={data.pillars} cadence={data.cadence} settings={data.settings} canManage={data.canManage} /> : null}
      </div>

      {dialog === "plan" ? <PlanDialog y={ym.y} m={ym.m} lastPlan={lastPlan} onClose={() => setDialog(null)} /> : null}
      {dialog === "quick" ? <QuickDialog defaultChannels={data.cadence.filter((c) => c.posts_per_week > 0).map((c) => c.channel)} onClose={() => setDialog(null)} onOpenItem={setOpenId} /> : null}
      {dialog === "add" ? <AddDialog pillars={data.pillars} onClose={() => setDialog(null)} onOpenItem={setOpenId} /> : null}
      {opened ? <ItemEditor key={`${opened.id}:${opened.status}:${opened.drafted_at ?? ""}`} item={opened} data={data} onClose={() => setOpenId(null)} /> : null}
    </div>
  );
};
