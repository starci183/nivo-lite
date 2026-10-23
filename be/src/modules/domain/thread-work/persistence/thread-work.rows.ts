import type { WorkspaceRole } from "@modules/domain/workspace-members"
import type { ThreadWorkState } from "../thread-work.contracts"

/** public.thread_work as the statements select it. */
export interface ThreadWorkRow {
    /** The row id. */
    id: string
    /** The workspace. */
    workspace_id: string
    /** The thread. */
    thread_id: string
    /** The work item. */
    work_item_id: string
    /** The agent doing it. */
    agent_id: string
    /** Constrained by a CHECK in the table. */
    state: ThreadWorkState
    /** The approval request it waits for, or null. */
    approval_request_id: string | null
    /** The member it asked for data, or null. */
    waiting_member_id: string | null
    /** The fields it asked for. */
    missing_fields: Array<string>
}

/** A thread work row that asked for an approval, with how the request ended. */
export interface SettledAskRow extends ThreadWorkRow {
    /** Constrained by a CHECK in approval_requests (a settled request is one of these). */
    request_status: "approved" | "rejected" | "expired"
    /** The member whose verdict settled it, or null when it expired. */
    resolved_by: string | null
}

/** An agent as the runtime reads it. */
export interface WorkAgentRow {
    /** The agent id. */
    id: string
    /** Its display name. */
    name: string
    /** Its department. */
    module: string
    /** The agents it may tag. */
    can_tag_agent_ids: Array<string>
}

/** A member as a decider. */
export interface DeciderRow {
    /** The member id. */
    id: string
    /** The display name. */
    display_name: string
    /** Constrained by a CHECK in the table. */
    role: WorkspaceRole
}

/** A customer as the work names it. */
export interface WorkLeadRow {
    /** The lead id. */
    id: string
    /** The name of the customer. */
    contact_name: string
}
