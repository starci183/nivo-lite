import type { Locale } from "@modules/platform/i18n"

/** Who a tag points at: a member (their id in the workspace, `workspace_members.id`), an agent or a group of people (`role:<role>` or `room:<key>`). */
export interface MentionRef {
    /** member, agent or group. */
    readonly kind: "member" | "agent" | "group"
    /** The member id (`workspace_members.id`), the agent id or the group id. */
    readonly id: string
}

/** Who acts in a step: a member or an agent. */
export interface ChainActor {
    /** member or agent. */
    readonly kind: "member" | "agent"
    /** The member id (`workspace_members.id`) or the agent id. */
    readonly id: string
}

/** What a step is: the actor doing it alone, asking people to decide, handing the work to someone, or being given work. */
export type ChainStepKind = "self" | "ask_approval" | "hand_off" | "assign"

/** Where a step stands: waiting for someone, done, refused, timed out, or stopped by the chain limits. */
export type ChainStepStatus = "waiting" | "done" | "rejected" | "expired" | "stopped"

/** Why the chain stopped on its own and went back to the agent's owner. */
export type ChainStopReason = "limit" | "loop"

/** What recording one more step of a chain takes. */
export interface NewChainStep {
    /** The workspace. */
    readonly workspaceId: string
    /** The thread the chain runs in. */
    readonly threadId: string
    /** Who acts. */
    readonly actor: ChainActor
    /** What kind of step it is. */
    readonly kind: ChainStepKind
    /** The short title of the step, as the panel shows it. */
    readonly action: string
    /** The line under the title, or an empty text. */
    readonly detail: string
    /** The authority rule that governed the step, when one did. */
    readonly rule: string | null
    /** Who the step tags or hands the work to, when it does. */
    readonly target: MentionRef | null
    /** The approval request the step waits on, when it asks for approval. */
    readonly approvalRequestId: string | null
    /** The language of the texts the capability writes into the workspace. */
    readonly locale: Locale
}

/** One recorded step of a chain, as the panel reads it. */
export interface ChainStep {
    /** The step id. */
    readonly id: string
    /** The place of the step in its chain, from 1. */
    readonly seq: number
    /** Who acted. */
    readonly actor: ChainActor
    /** The actor's display name. */
    readonly actorName: string
    /** The member's role or the agent's module. */
    readonly actorRole: string
    /** What kind of step it is. */
    readonly kind: ChainStepKind
    /** The short title. */
    readonly action: string
    /** The line under the title. */
    readonly detail: string
    /** The authority rule that governed it, or null. */
    readonly rule: string | null
    /** Who it tags, or null. */
    readonly target: MentionRef | null
    /** The approval request it waits on, or null. */
    readonly approvalRequestId: string | null
    /** Where it stands. */
    readonly status: ChainStepStatus
    /** The member who decided it, or null. */
    readonly decidedBy: string | null
    /** When it began, ISO 8601. */
    readonly startedAt: string
    /** When it ended, ISO 8601, or null while it waits. */
    readonly finishedAt: string | null
}

/** Whether the chain may go on after a step was judged. */
export type StepVerdict = { readonly kind: "continue" } | { readonly kind: "stop"; readonly reason: ChainStopReason }

/** A step that was recorded and lets the chain go on. */
export interface ContinuedStep {
    /** The stored step. */
    readonly step: ChainStep
    /** The chain goes on. */
    readonly verdict: "continue"
    /** Nothing stopped it. */
    readonly stopReason: null
    /** Nobody is sent the work back. */
    readonly ownerTag: null
}

/** A step the limits turned into a stopped hand-off to the agent's owner. */
export interface StoppedStep {
    /** The stored step: a stopped hand-off to the owner. */
    readonly step: ChainStep
    /** The chain stopped. */
    readonly verdict: "stopped"
    /** Why the chain stopped. */
    readonly stopReason: ChainStopReason
    /** The owner that is tagged. */
    readonly ownerTag: MentionRef
}

/** What recording a step answers: the stored step and whether the chain may go on. */
export type RecordedStep = ContinuedStep | StoppedStep

/** The line the panel shows over the steps: how many steps, how many decisions people made, how many minutes. */
export interface ChainSummary {
    /** How many steps the chain has. */
    readonly steps: number
    /** How many times a person decided. */
    readonly humanDecisions: number
    /** Minutes from the first step to the last one (to now while a step waits). */
    readonly minutes: number
    /** `empty`, `running` (a step waits), `stopped` (the limits stopped it) or `complete`. */
    readonly state: "empty" | "running" | "stopped" | "complete"
}

/** What the chain of a thread reads as: the steps in order and their summary. */
export interface ChainView {
    /** The steps, first to last. */
    readonly steps: ReadonlyArray<ChainStep>
    /** The summary line. */
    readonly summary: ChainSummary
}

/** What settles the approval step of a request. */
export interface ApprovalStepOutcome {
    /** The workspace. */
    readonly workspaceId: string
    /** The approval request. */
    readonly approvalRequestId: string
    /** The outcome: approved settles as done. */
    readonly outcome: "approved" | "rejected" | "expired"
    /** The member who decided, or null when nobody did (expiry). */
    readonly decidedBy: string | null
    /** The language of the evidence line the settlement writes. */
    readonly locale: Locale
}

/** The owner of an agent as the agents capability names them. */
export interface AgentOwner {
    /** The member who answers for the agent. */
    readonly ownerMemberId: string
    /** The member who answers when the owner is away or left. */
    readonly fallbackMemberId: string
}

/** Most automatic steps (steps an agent takes without a person in between) one chain may run. */
export const MAX_AUTOMATIC_STEPS = 12

/** How many times the same agent pair may already have done the same thing before the next repeat stops the chain. */
export const LOOP_REPEATS = 2

/** The step shape the limits are judged on. */
export type JudgedStep = Pick<ChainStep, "actor" | "kind" | "action" | "target">
