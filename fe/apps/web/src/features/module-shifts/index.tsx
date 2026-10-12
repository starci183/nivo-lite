import { EmptyNotice, SurfaceCard } from "@starci/grammar/common";
import { getT } from "@/i18n/server";
import { shifts as dict } from "@/i18n/dict/shifts";
import { loadAgentDashboard } from "@/lib/agent-dashboard";
import { workbenchHref } from "@/lib/agent-dashboard-shared";
import { loadBench, loadMine } from "@/lib/module-shifts-view";
import { loadSetup } from "@/lib/module-shifts-data";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { getShiftsFigures } from "@/lib/workbench-shifts";
import { Bench } from "./Bench";

/** Props for {@link WorkbenchShifts}. */
export type ShiftsWorkbenchProps = {
  /** `?tab=` from the route (week, requests, setup, quick, mine); anything else opens the first tab. */
  readonly tab?: string | null;
};

/**
 * Workbench slot of /agents/shifts/workbench: "Lịch & ca làm". Owners and managers get the agent dashboard frame (four figures, waiting, done, connections,
 * knowledge) around the bench's tabs; staff get their own schedule alone, without the workspace-wide figures.
 */
const WorkbenchShifts = async ({ tab = null }: ShiftsWorkbenchProps = {}) => {
  const t = await getT(dict);
  try {
    const s = await getSession();
    const db = await supabaseServer();
    const isManager = s.member.role !== "staff";
    const setup = await loadSetup(db, s.workspace.id, { withPay: false });
    const profile = (await db.rpc("shifts_my_profile", { ws: s.workspace.id })).data as string | null;
    // A "Chờ bạn" row of this module is a leave, swap or publish decision: all of them are answered in the Requests tab or the week's publish card.
    const dashboard = isManager ? loadAgentDashboard("shifts", { decisionHref: (item) => workbenchHref("shifts", { tab: "requests", focus: item.id }) }) : null;
    const figures = isManager ? getShiftsFigures(db, s.workspace.id).catch((e: unknown) => { console.error("shifts figures failed:", e instanceof Error ? e.message : e); return null; }) : null;
    const [bench, mine] = await Promise.all([
      isManager ? loadBench(db, s.workspace.id, s.member.role, s.userId) : Promise.resolve(null),
      loadMine(db, s.workspace.id, setup, profile),
    ]);
    return <Bench initial={bench} initialMine={mine} positions={setup.positions} dashboard={dashboard ? await dashboard : null} figures={figures ? await figures : null} initialTab={tab} />;
  } catch (e) {
    console.error("shifts workbench failed:", e instanceof Error ? e.message : e);
    return (
      <SurfaceCard ariaLabel={t("loadFailTitle")}>
        <EmptyNotice message={t("loadFailTitle")} description={t("loadFailBody")} />
      </SurfaceCard>
    );
  }
};

export default WorkbenchShifts;
