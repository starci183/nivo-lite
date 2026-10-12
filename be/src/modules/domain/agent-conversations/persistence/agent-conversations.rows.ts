import type { Database } from "../../../../../../supabase/types/database.types"

type Tables = Database["public"]["Tables"]
type AgentRow = Tables["agents"]["Row"]
type ConversationRow = Tables["agent_conversations"]["Row"]

/** A conversation as the intake reads it. */
export type ConversationRefRow = Pick<ConversationRow, "id" | "agent_id" | "lead_id" | "handled_by" | "visitor_name">

/** Where a conversation's replies go. */
export type ConversationTargetRow = Pick<ConversationRow, "id" | "workspace_id" | "channel" | "external_id" | "connection_id">

/** The conversation of a turn joined with the agent that speaks in it, as FIND_TURN_CONVERSATION selects it. */
export type TurnConversationRow = Pick<
    ConversationRow,
    "id" | "workspace_id" | "channel" | "external_id" | "connection_id" | "lead_id" | "handled_by" | "visitor_name" | "installation_id"
> & {
    agent_id: AgentRow["id"]
    agent_name: AgentRow["name"]
    agent_handle: AgentRow["handle"]
    agent_role: AgentRow["role"]
    agent_module: AgentRow["module"]
    agent_instructions: AgentRow["instructions"]
    agent_knowledge: AgentRow["knowledge"]
    agent_approval_rule: AgentRow["approval_rule"]
    agent_greeting: AgentRow["greeting"]
}
