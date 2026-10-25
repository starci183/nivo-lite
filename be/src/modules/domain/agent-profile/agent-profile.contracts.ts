import type { AgentOwnership, Region } from "@modules/domain/agents"
import type { RuleMode } from "@modules/domain/authority-rules"

/** What the profile page's header says about an agent. */
export interface AgentHead {
    /** The agent. */
    readonly id: string
    /** The display name. */
    readonly name: string
    /** The @handle. */
    readonly handle: string
    /** The one-line role. */
    readonly role: string
    /** The module (agent type). */
    readonly module: string
    /** active or paused. */
    readonly status: string
    /** The HTTPS address of the agent's picture, or null for the generated avatar. */
    readonly avatarUrl: string | null
    /** The name of the department room the agent is at home in, or null. */
    readonly roomName: string | null
    /** assist (asks first) or autopilot, from the instance that drives the agent; null when it has none. */
    readonly operatingMode: string | null
}

/** One rule of the owner's authority as the agent's page lists it, read-only. */
export interface AppliedRule {
    /** The action key. */
    readonly action: string
    /** The module the action belongs to. */
    readonly department: string
    /** auto, ask or never. */
    readonly mode: RuleMode
    /** The action runs alone strictly below this amount, VND; null for none. */
    readonly limitVnd: number | null
    /** The note shown with the rule; may be empty. */
    readonly note: string
}

/** The state of a piece of recent work. */
export type RecentWorkStatus = "queued" | "done" | "waiting_decision" | "rejected" | "failed"

/** One piece of recent work of the agent. */
export interface RecentWork {
    /** The work item. */
    readonly id: string
    /** The action key. */
    readonly action: string
    /** The one-line summary; empty when the item has none (the page shows the action label). */
    readonly title: string
    /** The customer the work is about, or an empty text. */
    readonly customer: string
    /** The state. */
    readonly status: RecentWorkStatus
    /** When it was last touched, ISO 8601. */
    readonly at: string
    /** The lead it is about, or null. */
    readonly leadId: string | null
}

/** Everything the agent profile page shows. */
export interface AgentPage {
    /** The header. */
    readonly agent: AgentHead
    /** Who is in charge, who may give it work, whom it may tag. */
    readonly ownership: AgentOwnership
    /** The rules that apply to the agent. */
    readonly rules: Region<ReadonlyArray<AppliedRule>>
    /** The latest work. */
    readonly recent: Region<ReadonlyArray<RecentWork>>
}

/** The kinds of party a thread message can mention. */
export type AssignmentMentionKind = "member" | "agent" | "group"

/** A mention of a thread message (the work threads' MentionRef). */
export interface AssignmentMention {
    /** Who is mentioned. */
    readonly kind: AssignmentMentionKind
    /** The member, agent or group. */
    readonly id: string
}

/** What opening an assignment thread takes. */
export interface AssignmentThreadInput {
    /** The workspace. */
    readonly workspaceId: string
    /** The member who hands the work over. */
    readonly authorMemberId: string
    /** The one-line title of the thread. */
    readonly title: string
    /** The plain text of the request; it is data, never parsed for mentions. */
    readonly text: string
    /** The only mentions of the first message: the agent the work is for. */
    readonly mentions: ReadonlyArray<AssignmentMention>
    /** The customer the work is about, or null. */
    readonly leadId: string | null
}

/** The thread an assignment opened. */
export interface AssignmentThread {
    /** The thread. */
    readonly threadId: string
}

/** The structured work a member hands an agent: an action of its department, the amount in the rule's unit, the customer. */
export interface AssignmentTask {
    /** The action key. */
    readonly action: string
    /** The amount in the unit of the action's rule, or null. */
    readonly amount: number | null
    /** The value of the deal in VND, or null. */
    readonly amountVnd: number | null
    /** The customer (`leads.id`). */
    readonly leadId: string
}

/** What handing an agent work takes. */
export interface AssignRequest {
    /** The agent. */
    readonly agentId: string
    /** What to do, as the person wrote it. */
    readonly text: string
    /** The action the agent starts on (an action of its department); absent or null for a request it only reads. */
    readonly action?: string | null
    /** The amount in the unit of the action's rule. */
    readonly amount?: number | null
    /** The value of the deal, VND. */
    readonly amountVnd?: number | null
    /** The customer the work is about; the work needs one. */
    readonly leadId?: string | null
}

/** The work the agents' runtime starts in the thread an assignment opened. */
export interface AssignmentWorkStart {
    /** The workspace. */
    readonly workspaceId: string
    /** The thread. */
    readonly threadId: string
    /** The agent. */
    readonly agentId: string
    /** The display name of the member who handed the work over. */
    readonly actorName: string
    /** The request in their words. */
    readonly summary: string
    /** The structured work. */
    readonly task: AssignmentTask
}

/** The longest request a person may hand an agent. */
export const ASSIGNMENT_TEXT_MAX = 2000

/** The longest title a thread of an assignment gets, clipped from the request. */
export const ASSIGNMENT_TITLE_MAX = 80
