import "server-only"
import { getT } from "@/i18n/server"
import { office } from "@/i18n/dict/office"
import { getSession } from "@/lib/session"
import { supabaseServer } from "@/lib/supabase/server"
import type { Execution } from "@/lib/types"

/** One pending execution with the lead context the approval card needs. */
export type PendingApproval = {
  readonly execution: Execution
  readonly leadName: string
  readonly channel: string
  readonly agentName: string
  readonly nextAction: string
  readonly href: string
  /** Staff member the underlying work item is assigned to (null: nobody, so only owner and manager decide it). */
  readonly assignedStaffId: string | null
}

type LeadRow = { id: string; contact_name: string; company: string; channel: string }
type RespRow = { id: string; lead_id: string; next_action: string; owner_name: string; lead: LeadRow | Array<LeadRow> | null }
type Embedded = Execution & {
  responsibility: RespRow | Array<RespRow> | null
  work_item: { id: string; assigned_staff_id: string | null } | Array<{ id: string; assigned_staff_id: string | null }> | null
  agent: { id: string; name: string } | Array<{ id: string; name: string }> | null
}

/** One request per list: the responsibility, its lead, the work item and the agent come embedded in the execution rows. */
const EXECUTION_SELECT = "*, responsibility:responsibilities(id, lead_id, next_action, owner_name, lead:leads(id, contact_name, company, channel)), work_item:work_items!work_item_id(id, assigned_staff_id), agent:agents(id, name)"

const one = <T,>(v: T | Array<T> | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v)

/** Attach lead, agent and responsibility context to a list of executions. */
const hydrate = async (rows: ReadonlyArray<Embedded>): Promise<ReadonlyArray<PendingApproval>> => {
  if (rows.length === 0) return []
  const t = await getT(office)
  return rows.map(({ responsibility, work_item, agent: agentRow, ...execution }) => {
    const resp = one(responsibility)
    const lead = one(resp?.lead ?? null)
    const agent = one(agentRow)
    const work = one(work_item)
    return {
      execution: execution as Execution,
      leadName: lead ? `${lead.contact_name} - ${lead.company}` : t("unknownLead"),
      channel: lead?.channel ?? "",
      agentName: agent?.name ?? resp?.owner_name ?? t("agentFallback"),
      nextAction: resp?.next_action ?? "",
      href: lead ? `/leads/${lead.id}` : "/leads",
      assignedStaffId: work?.assigned_staff_id ?? null,
    }
  })
}

/** Executions waiting for a human decision in the signed-in workspace, newest first. */
export const listPendingApprovals = async (): Promise<ReadonlyArray<PendingApproval>> => {
  const session = await getSession()
  const supabase = await supabaseServer()
  const { data } = await supabase
    .from("executions")
    .select(EXECUTION_SELECT)
    .eq("workspace_id", session.workspace.id)
    .eq("status", "pending_approval")
    .order("created_at", { ascending: false })
  return hydrate((data ?? []) as unknown as Array<Embedded>)
}

/** The most recently approved or rejected executions, newest decision first. */
export const listDecidedApprovals = async (): Promise<ReadonlyArray<PendingApproval>> => {
  const session = await getSession()
  const supabase = await supabaseServer()
  const { data } = await supabase
    .from("executions")
    .select(EXECUTION_SELECT)
    .eq("workspace_id", session.workspace.id)
    .in("status", ["approved", "rejected"])
    .order("decided_at", { ascending: false, nullsFirst: false })
    .limit(8)
  return hydrate((data ?? []) as unknown as Array<Embedded>)
}
