"use client";

import { useCallback, useState } from "react";
import { Tabs } from "@starci/grammar/common";
import { useT } from "@/i18n/client";
import { shifts as dict } from "@/i18n/dict/shifts";
import type { BenchData, MineData } from "@/lib/module-shifts-view";
import type { ShiftPosition } from "@/lib/module-shifts-types";
import { loadBenchAction, loadMineAction } from "./actions";
import { MineView } from "./MineView";
import { QuickImport } from "./QuickImport";
import { RequestsPanel } from "./RequestsPanel";
import { SetupPanel } from "./SetupPanel";
import { WeekPanel } from "./WeekPanel";
import { BENCH_CLASS_NAME } from "./classNames";

type Tab = "week" | "requests" | "setup" | "quick" | "mine";
type Props = { readonly initial: BenchData | null; readonly initialMine: MineData; readonly positions: ReadonlyArray<ShiftPosition>; readonly isManager: boolean };

/** The shifts workbench: managers get the week, requests, setup and quick-import tabs (and "Lịch của tôi" when they are on the schedule); staff only see their own schedule. */
export const Bench = ({ initial, initialMine, positions, isManager }: Props) => {
  const t = useT(dict);
  const [data, setData] = useState<BenchData | null>(initial);
  const [mine, setMine] = useState<MineData>(initialMine);
  const [tab, setTab] = useState<Tab>(isManager ? "week" : "mine");
  const monday = data?.week.monday;

  const reload = useCallback(async (to?: string) => {
    if (isManager) {
      const r = await loadBenchAction(to ?? monday ?? new Date().toISOString().slice(0, 10));
      if (r.ok) setData(r.data);
    }
    const m = await loadMineAction();
    if (m.ok) setMine(m.data);
  }, [isManager, monday]);
  const reloadAll = useCallback(async () => { await reload(); }, [reload]);

  const open = data ? data.requests.leaves.filter((l) => l.status === "pending").length + data.requests.swaps.filter((s) => s.status === "pending").length + data.requests.availability.filter((a) => a.status === "pending").length : 0;
  const items = isManager
    ? [
      { id: "week", label: t("tabWeek") },
      { id: "requests", label: open ? `${t("tabRequests")} (${open})` : t("tabRequests") },
      { id: "setup", label: t("tabSetup") },
      { id: "quick", label: t("tabQuick") },
      ...(mine.profileId ? [{ id: "mine", label: t("tabMine") }] : []),
    ]
    : [{ id: "mine", label: t("tabMine") }];

  return (
    <div className={BENCH_CLASS_NAME}>
      {isManager ? <Tabs label={t("tabsLabel")} selectedKey={tab} inset="none" labelVisibility="always" items={items} onSelect={(k) => setTab(k as Tab)} /> : null}
      {isManager && data && tab === "week" ? <WeekPanel data={data} canManage onReload={reload} /> : null}
      {isManager && data && tab === "requests" ? <RequestsPanel data={data} onReload={reloadAll} /> : null}
      {isManager && data && tab === "setup" ? <SetupPanel data={data} onReload={reloadAll} /> : null}
      {isManager && data && tab === "quick" ? <QuickImport data={data} onReload={reloadAll} /> : null}
      {tab === "mine" ? <MineView mine={mine} positions={data?.setup.positions ?? positions} onReload={reloadAll} /> : null}
    </div>
  );
};
