import { listAgents, listRecentEvents, listResponsibilities } from "@/lib/queries";
import { groupByOwner, hourInZone, stamp, toActivityModels, toRowModels } from "@/features/responsibilities/format";
import { getLocale, getT } from "@/i18n/server";
import { overview } from "@/i18n/dict/overview";
import { responsibilities as respDict } from "@/i18n/dict/responsibilities";
import { buildPromoState, getPromoState } from "@/features/promo/queries";
import { getGovernance, governanceFrom, isTestRunName, isTestRunWorkItem, listExceptions, workViewsFrom } from "@/lib/flow-queries";
import { getDashboardData } from "@/lib/page-data";
import { getSession } from "@/lib/session";
import { OverviewBase } from "./component";
import { getOverviewFacts, overviewFactsFrom } from "./queries";

/** Connected P01 view: reads responsibilities, agents, events and real pipeline facts, then renders the overview. */
export const Overview = async () => {
  // ONE request (SQL function dashboard_data) returns every row this view reads; if it is unavailable the separate reads below take over.
  const raw = await getDashboardData();
  const session = await getSession();
  const [allResponsibilities, agents, events, facts, promo, governance, exceptions] = raw
    ? [
        raw.responsibilities, raw.agents, raw.events,
        overviewFactsFrom(session.userName, raw.leads, raw.pending.map((p) => ({ leadId: p.lead_id }))),
        await buildPromoState(raw.promo),
        (() => { try { return governanceFrom(raw.governance, raw.since7); } catch { return null; } })(),
        workViewsFrom(raw.exceptions),
      ] as const
    : await Promise.all([
        listResponsibilities(),
        listAgents(),
        listRecentEvents(6),
        getOverviewFacts(),
        getPromoState(),
        getGovernance().catch(() => null),
        listExceptions().catch(() => []),
      ]);
  // Test runs (UAT/DBG, see TEST_RUN_PATTERN in flow-queries) are left out of every dashboard figure.
  const responsibilities = allResponsibilities.filter((r) => !isTestRunName(r.lead?.contact_name, r.lead?.company));
  const [t, rt, locale] = await Promise.all([getT(overview), getT(respDict), getLocale()]);
  const now = new Date();
  const hour = hourInZone(now);
  const greeting = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  const rows = toRowModels(responsibilities, agents, now, rt);
  const active = rows.filter((row) => row.status !== "done");
  return (
    <OverviewBase
      title={t(greeting, { name: facts.firstName })}
      updatedLabel={stamp(now, locale)}
      verifiedLabel={t("verified", { time: stamp(now, locale) })}
      groups={groupByOwner(active)}
      groupTotal={active.length}
      counts={{
        open: rows.filter((row) => row.status === "open").length,
        waitingApproval: rows.filter((row) => row.status === "waiting_approval").length,
        dueToday: active.filter((row) => row.isDueToday).length,
        overdue: active.filter((row) => row.isOverdue).length,
        leadsThisWeek: facts.leadsThisWeek,
      }}
      governance={governance}
      waiting={exceptions.filter((item) => item.status === "waiting_decision" && !isTestRunWorkItem(item))}
      agents={agents.map((agent) => ({ id: agent.id, name: agent.name, handle: agent.handle, status: agent.status, module: agent.module }))}
      activity={toActivityModels(events, now, rt)}
      hasAgents={agents.length > 0}
      promo={promo}
    />
  );
};
