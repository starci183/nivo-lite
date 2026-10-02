import "server-only";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { isTestRunName } from "@/lib/flow-queries";
import type { LeadStage } from "@/lib/types";

/** What waits for a human decision: how many drafts, and where to review the newest. */
export type PendingDecisions = { count: number; href: string };

/** Lead counts per pipeline stage, in pipeline order, with the total. */
export type PipelineCounts = { total: number; stages: ReadonlyArray<{ stage: LeadStage; count: number }> };

/** Real overview figures that the responsibilities list does not already carry. */
export type OverviewFacts = {
  firstName: string;
  pending: PendingDecisions;
  leadsThisWeek: number;
  pipeline: PipelineCounts;
};

const STAGES: ReadonlyArray<LeadStage> = ["new", "qualified", "proposal", "won", "lost"];
const WEEK_MS = 7 * 86_400_000;

/** Read pending approvals, lead stages and this week's new leads for the signed-in workspace. */
export const getOverviewFacts = async (): Promise<OverviewFacts> => {
  const session = await getSession();
  const supabase = await supabaseServer();
  const ws = session.workspace.id;
  const [leadRes, execRes] = await Promise.all([
    supabase.from("leads").select("id, stage, created_at, contact_name, company").eq("workspace_id", ws),
    supabase
      .from("executions")
      .select("id, responsibility_id, created_at, responsibility:responsibilities(lead_id)")
      .eq("workspace_id", ws)
      .eq("status", "pending_approval")
      .order("created_at", { ascending: false }),
  ]);
  // Test runs (UAT/DBG, see TEST_RUN_PATTERN in flow-queries) are left out of every dashboard figure.
  const leads = ((leadRes.data ?? []) as Array<{ id: string; stage: LeadStage; created_at: string; contact_name: string | null; company: string | null }>)
    .filter((lead) => !isTestRunName(lead.contact_name, lead.company));
  const executions = (execRes.data ?? []) as unknown as Array<{ id: string; responsibility_id: string; created_at: string; responsibility: { lead_id: string } | Array<{ lead_id: string }> | null }>;

  let href = "/responsibilities?status=waiting_approval";
  const newest = executions[0];
  if (newest !== undefined) {
    // The lead comes with the execution (embedded), so this costs no extra request.
    const leadId = (Array.isArray(newest.responsibility) ? newest.responsibility[0] : newest.responsibility)?.lead_id;
    if (executions.length === 1 && leadId !== undefined) href = `/leads/${leadId}`;
  }

  const since = Date.now() - WEEK_MS;
  return {
    firstName: session.userName.split(/\s+/)[0] ?? session.userName,
    pending: { count: executions.length, href },
    leadsThisWeek: leads.filter((lead) => new Date(lead.created_at).getTime() >= since).length,
    pipeline: {
      total: leads.length,
      stages: STAGES.map((stage) => ({ stage, count: leads.filter((lead) => lead.stage === stage).length })),
    },
  };
};
