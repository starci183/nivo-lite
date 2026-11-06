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
