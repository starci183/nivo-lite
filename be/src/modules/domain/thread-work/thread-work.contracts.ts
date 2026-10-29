import type { WorkspaceRole } from "@modules/domain/workspace-members"
import type { ProposalFieldValue } from "@modules/domain/work-items"
import type { Locale } from "@modules/platform/i18n"

/** Where a piece of thread work stands. */
export type ThreadWorkState = "running" | "asked" | "waiting_member" | "done" | "stopped"

/** The work a member hands an agent: an action of the agent's department, its amount in the rule's unit and the customer. */
export interface AssignedTask {
    /** The action key; it must belong to the department of the agent. */
    readonly action: string
    /** The amount in the unit of the action's rule (a percentage, a count or VND), or null. */
    readonly amount: number | null
    /** The value of the deal in VND, or null. */
    readonly amountVnd: number | null
    /** The customer the work is about (`leads.id`). */
    readonly leadId: string
}

/** A member gave an agent work in a thread: the agents' runtime starts it there. */
export interface ThreadWorkStart {
    /** The workspace. */
    readonly workspaceId: string
    /** The thread the work runs in. */
    readonly threadId: string
    /** The agent that does it. */
    readonly agentId: string
    /** The display name of whoever gave the work, for the logs. */
    readonly actorName: string
    /** What was asked, in the member's words. */
    readonly summary: string
    /** The structured work. */
    readonly task: AssignedTask
}

/** A member wrote in a thread: if an agent waited for their answer, the work goes on with it. */
export interface MemberReply {
    /** The workspace. */
    readonly workspaceId: string
    /** The thread. */
    readonly threadId: string
    /** The member who wrote (`workspace_members.id`). */
    readonly memberId: string
    /** What they wrote. */
    readonly body: string
}

/** The agent doing a piece of thread work, as the runtime reads it. */
export interface WorkAgent {
    /** The agent id. */
    readonly id: string
    /** Its display name. */
    readonly name: string
    /** Its department (module key). */
    readonly module: string
    /** The agents it may pass work to. */
    readonly canTag: ReadonlyArray<string>
}

/** The address of one piece of thread work while the runtime moves it. */
export interface WorkPlace {
    /** The workspace. */
    readonly workspaceId: string
    /** The thread. */
    readonly threadId: string
    /** The `thread_work` row. */
    readonly workId: string
    /** The agent doing it. */
    readonly agent: WorkAgent
    /** The language of the lines the agents write. */
    readonly locale: Locale
}

/** One step an agent takes in a thread: the action it runs, about which customer, with what it knows, after which item. */
export interface AgentStep {
    /** The workspace. */
    readonly workspaceId: string
    /** The thread. */
    readonly threadId: string
    /** The agent that runs it. */
    readonly agent: WorkAgent
    /** The action key. */
    readonly action: string
    /** The customer. */
    readonly leadId: string
    /** What the agent starts from. */
    readonly seed: StepSeed
    /** The item this one follows, or null for the first. */
    readonly parentId: string | null
    /** The display name of whoever started the chain, for the logs. */
    readonly actorName: string
}

/** What a step starts from: its sentence, its money and its fields. */
export interface StepSeed {
    /** One sentence. */
    readonly summary: string
    /** The text the step sends, when it sends one. */
    readonly draft?: string
    /** The money, VND, or null. */
    readonly amount_vnd: number | null
    /** The structured fields. */
    readonly fields: Readonly<Record<string, ProposalFieldValue>>
}

/** The next step of a finished one: the action and the agent that takes it. */
export interface NextStep {
    /** The action key. */
    readonly action: string
    /** The agent that takes it. */
    readonly agent: WorkAgent
}

/** A member's decision as the work engine takes it. */
export interface MemberDecider {
    /** The display name. */
    readonly name: string
    /** Owner or staff. */
    readonly kind: "owner" | "staff"
    /** The member (`workspace_members.id`). */
    readonly memberId: string
}

/** What one minute tick of the agents' work moved. */
export interface ThreadWorkTick {
    /** The queued chain steps that went through the gate. */
    readonly steps: number
    /** The pieces of thread work whose settled approval moved them on. */
    readonly settled: number
}

/** One piece of thread work as the runtime reads it. */
export interface ThreadWorkRecord {
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

/** A piece of thread work that asked for an approval, with how the request ended. */
export interface SettledAskRecord extends ThreadWorkRecord {
    /** Constrained by a CHECK in approval_requests (a settled request is one of these). */
    request_status: "approved" | "rejected" | "expired"
    /** The member whose verdict settled it, or null when it expired. */
    resolved_by: string | null
}

/** An agent as the runtime reads it. */
export interface WorkAgentRecord {
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
export interface DeciderRecord {
    /** The member id. */
    id: string
    /** The display name. */
    display_name: string
    /** Constrained by a CHECK in the table. */
    role: WorkspaceRole
}

/** A customer as the work names it. */
export interface WorkLeadRecord {
    /** The lead id. */
    id: string
    /** The name of the customer. */
    contact_name: string
}
