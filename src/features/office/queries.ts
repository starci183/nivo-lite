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

type RespRow = { id: string; lead_id: string; next_action: string; owner_name: string }
type LeadRow = { id: string; contact_name: string; company: string; channel: string }
type AgentRow = { id: string; name: string }

type Supabase = Awaited<ReturnType<typeof supabaseServer>>

/** Attach lead, agent and responsibility context to a list of executions. */
const hydrate = async (supabase: Supabase, executions: ReadonlyArray<Execution>): Promise<ReadonlyArray<PendingApproval>> => {
  if (executions.length === 0) return []
  const t = await getT(office)

  const respIds = [...new Set(executions.map((e) => e.responsibility_id))]
  const agentIds = [...new Set(executions.map((e) => e.agent_id).filter((id): id is string => id !== null))]
  const { data: respData } = await supabase.from("responsibilities").select("id, lead_id, next_action, owner_name").in("id", respIds)
  const resps = (respData ?? []) as Array<RespRow>
  const leadIds = [...new Set(resps.map((r) => r.lead_id))]
  const workIds = [...new Set(executions.map((e) => e.work_item_id).filter((id): id is string => !!id))]
  const workRes = workIds.length ? await supabase.from("work_items").select("id, assigned_staff_id").in("id", workIds) : { data: [] }
  const assignedBy = new Map(((workRes.data ?? []) as Array<{ id: string; assigned_staff_id: string | null }>).map((w) => [w.id, w.assigned_staff_id]))
  const [leadRes, agentRes] = await Promise.all([
    leadIds.length ? supabase.from("leads").select("id, contact_name, company, channel").in("id", leadIds) : Promise.resolve({ data: [] }),
    agentIds.length ? supabase.from("agents").select("id, name").in("id", agentIds) : Promise.resolve({ data: [] }),
  ])
  const leads = (leadRes.data ?? []) as Array<LeadRow>
  const agents = (agentRes.data ?? []) as Array<AgentRow>

  return executions.map((execution) => {
    const resp = resps.find((r) => r.id === execution.responsibility_id)
    const lead = leads.find((l) => l.id === resp?.lead_id)
    const agent = agents.find((a) => a.id === execution.agent_id)
    return {
      execution,
      leadName: lead ? `${lead.contact_name} - ${lead.company}` : t("unknownLead"),
      channel: lead?.channel ?? "",
      agentName: agent?.name ?? resp?.owner_name ?? t("agentFallback"),
      nextAction: resp?.next_action ?? "",
      href: lead ? `/leads/${lead.id}` : "/leads",
      assignedStaffId: execution.work_item_id ? (assignedBy.get(execution.work_item_id) ?? null) : null,
    }
  })
}

/** Executions waiting for a human decision in the signed-in workspace, newest first. */
export const listPendingApprovals = async (): Promise<ReadonlyArray<PendingApproval>> => {
  const session = await getSession()
  const supabase = await supabaseServer()
  const { data } = await supabase
    .from("executions")
    .select("*")
    .eq("workspace_id", session.workspace.id)
    .eq("status", "pending_approval")
    .order("created_at", { ascending: false })
  return hydrate(supabase, (data ?? []) as Array<Execution>)
}

/** The most recently approved or rejected executions, newest decision first. */
export const listDecidedApprovals = async (): Promise<ReadonlyArray<PendingApproval>> => {
  const session = await getSession()
  const supabase = await supabaseServer()
  const { data } = await supabase
    .from("executions")
    .select("*")
    .eq("workspace_id", session.workspace.id)
    .in("status", ["approved", "rejected"])
    .order("decided_at", { ascending: false, nullsFirst: false })
    .limit(8)
  return hydrate(supabase, (data ?? []) as Array<Execution>)
}
