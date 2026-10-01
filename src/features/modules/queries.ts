import "server-only"
import { getSession } from "@/lib/session"
import { supabaseServer } from "@/lib/supabase/server"
import type { Agent, AgentConversation } from "@/lib/types"

/** One installed agent with the counts read from the workspace. */
export type AgentStats = {
  readonly agent: Agent
  readonly conversations: number
  readonly customerConversations: number
  readonly leadsCaptured: number
  readonly openResponsibilities: number
}

/** One conversation of an agent with the lead it produced, if any. */
export type AgentConversationRow = {
  readonly id: string
  readonly kind: AgentConversation["kind"]
  readonly visitorName: string | null
  readonly createdAt: string
  readonly leadId: string | null
  readonly leadName: string | null
}

type ConversationRow = Pick<AgentConversation, "id" | "agent_id" | "kind" | "lead_id">
type OwnedRow = { owner_agent_id: string | null }

/** Installed agents of the signed-in workspace with real conversation, lead and responsibility counts. */
export const listAgentStats = async (): Promise<ReadonlyArray<AgentStats>> => {
  const session = await getSession()
  const supabase = await supabaseServer()
  const workspaceId = session.workspace.id
  const [agentRes, convRes, respRes] = await Promise.all([
    supabase.from("agents").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: true }),
    supabase.from("agent_conversations").select("id, agent_id, kind, lead_id").eq("workspace_id", workspaceId),
    supabase.from("responsibilities").select("owner_agent_id").eq("workspace_id", workspaceId).neq("status", "done").not("owner_agent_id", "is", null),
  ])
  const agents = (agentRes.data ?? []) as Agent[]
  const conversations = (convRes.data ?? []) as ConversationRow[]
  const owned = (respRes.data ?? []) as OwnedRow[]
  return agents.map((agent) => {
    const mine = conversations.filter((c) => c.agent_id === agent.id)
    return {
      agent,
      conversations: mine.length,
      customerConversations: mine.filter((c) => c.kind === "customer").length,
      leadsCaptured: new Set(mine.map((c) => c.lead_id).filter((id): id is string => id !== null)).size,
      openResponsibilities: owned.filter((r) => r.owner_agent_id === agent.id).length,
    }
  })
}

/** Conversations of one agent, newest first, with the name of the captured lead. */
export const listAgentConversationRows = async (agentId: string): Promise<ReadonlyArray<AgentConversationRow>> => {
  const supabase = await supabaseServer()
  const { data } = await supabase.from("agent_conversations").select("*").eq("agent_id", agentId).order("created_at", { ascending: false })
  const conversations = (data ?? []) as AgentConversation[]
  const leadIds = [...new Set(conversations.map((c) => c.lead_id).filter((id): id is string => id !== null))]
  const { data: leadData } = leadIds.length > 0 ? await supabase.from("leads").select("id, contact_name").in("id", leadIds) : { data: [] }
  const names = new Map(((leadData ?? []) as Array<{ id: string; contact_name: string }>).map((l) => [l.id, l.contact_name]))
  return conversations.map((c) => ({
    id: c.id,
    kind: c.kind,
    visitorName: c.visitor_name,
    createdAt: c.created_at,
    leadId: c.lead_id,
    leadName: c.lead_id === null ? null : (names.get(c.lead_id) ?? null),
  }))
}
