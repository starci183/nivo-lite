import { EmptyNotice, SurfaceCard } from "@starci/grammar/common";
import { getT } from "@/i18n/server";
import { shifts as dict } from "@/i18n/dict/shifts";
import { loadBench, loadMine } from "@/lib/module-shifts-view";
import { loadSetup } from "@/lib/module-shifts-data";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { Bench } from "./Bench";

/** Workbench slot of /m/shifts/workbench: "Lịch & ca làm". Owners and managers get the whole bench; staff get their own schedule. */
const WorkbenchShifts = async () => {
  const t = await getT(dict);
  try {
    const s = await getSession();
    const db = await supabaseServer();
    const isManager = s.member.role !== "staff";
    const setup = await loadSetup(db, s.workspace.id, { withPay: false });
    const profile = (await db.rpc("shifts_my_profile", { ws: s.workspace.id })).data as string | null;
    const [bench, mine] = await Promise.all([
      isManager ? loadBench(db, s.workspace.id, s.member.role, s.userId) : Promise.resolve(null),
      loadMine(db, s.workspace.id, setup, profile),
    ]);
    return <Bench initial={bench} initialMine={mine} positions={setup.positions} isManager={isManager} />;
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
