"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import type { DescriptionListStatItem } from "@starci/grammar/common";
import { AgentDashboardFrame } from "@/features/agent-dashboard";
import { useT } from "@/i18n/client";
import { shifts as dict } from "@/i18n/dict/shifts";
import { workbenchFigures } from "@/i18n/dict/workbenchFigures";
import type { AgentDashboardData } from "@/lib/agent-dashboard-shared";
import type { BenchData, MineData } from "@/lib/module-shifts-view";
import type { ShiftPosition } from "@/lib/module-shifts-types";
import type { ShiftsFigures } from "@/lib/workbench-shifts";
import { loadBenchAction, loadMineAction } from "./actions";
import { MineView } from "./MineView";
import { QuickImport } from "./QuickImport";
import { RequestsPanel } from "./RequestsPanel";
import { SetupPanel } from "./SetupPanel";
import { WeekPanel } from "./WeekPanel";
import { BENCH_CLASS_NAME } from "./classNames";

type Tab = "week" | "requests" | "setup" | "quick" | "mine";
const TABS: ReadonlyArray<Tab> = ["week", "requests", "setup", "quick", "mine"];
const isTab = (key: string | null | undefined): key is Tab => !!key && (TABS as ReadonlyArray<string>).includes(key);

type Props = {
  readonly initial: BenchData | null;
  readonly initialMine: MineData;
  readonly positions: ReadonlyArray<ShiftPosition>;
  /** The frame's common regions; null for staff, who get their own schedule only. */
  readonly dashboard: AgentDashboardData | null;
  /** The ribbon's four figures; null when they could not be read (a manager) or for staff. */
  readonly figures: ShiftsFigures | null;
  /** The tab named in `?tab=`, already read on the server. */
  readonly initialTab: string | null;
};

/**
 * The shifts workbench. Managers: the agent dashboard frame (four figures, waiting, done, connections, knowledge) around the week, requests, setup and
 * quick-import tabs (and "Lịch của tôi" when they are on the schedule). Staff: only their own schedule, with no workspace-wide figures.
 */
export const Bench = ({ initial, initialMine, positions, dashboard, figures, initialTab }: Props) => {
  const t = useT(dict);
  const tf = useT(workbenchFigures);
  const router = useRouter();
  const isManager = dashboard !== null && initial !== null;
  const [data, setData] = useState<BenchData | null>(initial);
  const [mine, setMine] = useState<MineData>(initialMine);
  const monday = data?.week.monday;

  /** Reload the bench. A change (no week given) also refreshes the server side, so the ribbon and the frame's lists follow it. */
  const reload = useCallback(async (to?: string) => {
    if (isManager) {
      const r = await loadBenchAction(to ?? monday ?? new Date().toISOString().slice(0, 10));
      if (r.ok) setData(r.data);
    }
    const m = await loadMineAction();
    if (m.ok) setMine(m.data);
    if (isManager && to === undefined) router.refresh();
  }, [isManager, monday, router]);
  const reloadAll = useCallback(async () => { await reload(); }, [reload]);

  if (!isManager || !data) {
    return (
      <div className={BENCH_CLASS_NAME}>
        <MineView mine={mine} positions={data?.setup.positions ?? positions} onReload={reloadAll} />
      </div>
    );
  }

  const open = data.requests.leaves.filter((l) => l.status === "pending").length + data.requests.swaps.filter((s) => s.status === "pending").length + data.requests.availability.filter((a) => a.status === "pending").length;
  const ribbon: ReadonlyArray<DescriptionListStatItem> = figures
    ? [
      {
        id: "week", term: tf("shWeek"), description: figures.week.hasSchedule ? `${figures.week.filled}/${figures.week.total}` : "—",
        meta: figures.week.hasSchedule ? tf("shWeekMeta", { filled: figures.week.filled, total: figures.week.total }) : tf("shWeekNone"),
      },
      { id: "gaps", term: tf("shGaps"), description: String(figures.openGaps), meta: tf("shGapsMeta") },
      { id: "leave", term: tf("shLeave"), description: String(figures.leavePending), meta: tf("shLeaveMeta") },
      { id: "hours", term: tf("shHours"), description: String(figures.hoursMonth), unit: tf("shHoursUnit"), meta: tf("shHoursMeta") },
    ]
    : [];

  return (
    <AgentDashboardFrame
      module="shifts"
      data={dashboard}
      figures={ribbon}
      figuresFailed={figures === null}
      initialTab={isTab(initialTab) ? initialTab : null}
      tabs={[
        { id: "week", label: t("tabWeek"), content: <WeekPanel data={data} canManage onReload={reload} /> },
        { id: "requests", label: open ? `${t("tabRequests")} (${open})` : t("tabRequests"), content: <RequestsPanel data={data} onReload={reloadAll} /> },
        { id: "setup", label: t("tabSetup"), content: <SetupPanel data={data} onReload={reloadAll} /> },
        { id: "quick", label: t("tabQuick"), content: <QuickImport data={data} onReload={reloadAll} /> },
        ...(mine.profileId ? [{ id: "mine", label: t("tabMine"), content: <MineView mine={mine} positions={data.setup.positions} onReload={reloadAll} /> }] : []),
      ]}
    />
  );
};
