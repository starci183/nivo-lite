/** Where the freeze of a customer stands: frozen for the owner, being retried, or released. */
export type FreezeStatus = "frozen" | "retrying" | "released"

/** What kind of event reached a frozen customer: a line they wrote, a bank transaction, a timer or reminder, a hand-off, or anything else. */
export type PendingKind = "message" | "payment" | "timer" | "handoff" | "event"

/** One flag or text of a wake's context, as a pending event keeps it. */
export type PendingContextValue = string | boolean

/** A wake that reached a frozen customer and started no run: recorded in the order it came, replayed on release. */
export interface PendingEvent {
    /** The wake that was held. */
    readonly wakeId: string
    /** The agent it woke. */
    readonly agentId: string
    /** Where it came from. */
    readonly source: string
    /** The fact's key. */
    readonly eventKey: string
    /** The lock scope it ran under. */
    readonly scopeKey: string
    /** Ids and flags of the fact, as the wake carried them. */
    readonly context: Readonly<Record<string, PendingContextValue>>
    /** The member behind it, when a person was. */
    readonly actorMemberId: string | null
    /** What kind of event it is. */
    readonly kind: PendingKind
    /** When it was held, ISO text. */
    readonly at: string
    /** The conversation of a customer line, else null. */
    readonly conversationId: string | null
    /** The customer messages a line carried, oldest first. */
    readonly messageIds: ReadonlyArray<string>
    /** True once a retry showed the lines to the failed turn: a successful retry answered them, so they are not replayed. */
    readonly folded: boolean
}

/** Who a freeze is about: a lead, else the conversation of a customer who is not a lead yet. */
export interface FreezeSubject {
    /** `lead:<id>` or `conversation:<id>`, with `|wf:<workflowId>` when the freeze holds one workflow of the customer. */
    readonly key: string
    /** The lead, when known. */
    readonly leadId: string | null
    /** The conversation, when known. */
    readonly conversationId: string | null
}

/** The freeze of one customer, as the record keeps it. */
export interface LeadFreeze extends FreezeSubject {
    /** The record id. */
    readonly id: string
    /** The record version: the fence of every write. */
    readonly version: string
    /** Where it stands. */
    readonly status: FreezeStatus
    /** The run that failed for good. */
    readonly frozenRunId: string | null
    /** The agent of that run. */
    readonly agentId: string | null
    /** When it froze, ISO text. */
    readonly frozenAt: string | null
    /** Why the run failed: the error code. */
    readonly frozenReason: string | null
    /** The step it failed on. */
    readonly stepKey: string | null
    /** The title of that step, in the owner's language. */
    readonly stepTitle: string | null
    /** The customer's name, when known. */
    readonly customerName: string | null
    /** The owner's one work item of this freeze. */
    readonly workItemId: string | null
    /** How many times this customer froze. */
    readonly episode: number
    /** How many times the run failed in this freeze. */
    readonly failures: number
    /** The person who took the conversation over, or null. */
    readonly heldBy: string | null
    /** When it was released, ISO text. */
    readonly releasedAt: string | null
    /** Who released it. */
    readonly releasedBy: string | null
    /** `retried` or `skipped`. */
    readonly releaseReason: string | null
    /** The events held while frozen, in order. */
    readonly pending: ReadonlyArray<PendingEvent>
}

/** An optional freeze. */
export type OptionalLeadFreeze = LeadFreeze | null

/** The fields of a freeze a write sets. */
export interface FreezeValues extends Partial<Omit<LeadFreeze, "id" | "version" | "key">> {
    /** The events held while frozen, in order, when the write changes them. */
    readonly pending?: ReadonlyArray<PendingEvent>
}

/** The step a stopped run failed on, as the freeze reads it. */
export interface StoppedStep {
    /** The step. */
    readonly stepKey: string
    /** Its node. */
    readonly nodeKey: string
    /** The handler kind. */
    readonly kind: string
    /** Whether it is a node step of a graph: only a graph run freezes its customer. */
    readonly nodeStep: boolean
    /** Why it failed. */
    readonly errorCode: string | null
    /** Its stored input. */
    readonly input: Readonly<Record<string, unknown>>
}

/** The run that stopped, as the freeze reads it. */
export interface StoppedRun {
    /** The run. */
    readonly runId: string
    /** Its agent. */
    readonly agentId: string
    /** Where it stands. */
    readonly status: string
    /** The step it failed on; null when no step failed. */
    readonly failed: StoppedStep | null
    /** The run's context: the wake's ids and flags. */
    readonly context: Readonly<Record<string, unknown>>
    /** The language the run speaks. */
    readonly locale: FreezeLocale
}

/** The run that stopped, or null when there is no such run. */
export type OptionalStoppedRun = StoppedRun | null

/** Where a run stands, or null when it is gone. */
export type OptionalRunStatus = string | null

/** A text that may be missing: a lead, a name, a title. */
export type OptionalText = string | null

/** The language the owner reads the freeze in. */
export type FreezeLocale = "vi" | "en"

/** A run that stopped for good, as the graph flows tell the freeze: the run, why, and the trigger when the caller holds it. */
export interface FreezeStop {
    /** The workspace. */
    readonly workspaceId: string
    /** The run. */
    readonly runId: string
    /** Why it stopped. */
    readonly code: string
    /** The step it stopped on, when the caller knows it. */
    readonly stepKey: string | null
    /** The trigger scope of the run, when the caller holds it. */
    readonly trigger: Readonly<Record<string, unknown>> | null
}

/** How the resume of a retry went, as the run engine answers it. */
export interface RetryResume {
    /** `resumed`, or why the run did not go back on its failed step. */
    readonly kind: string
}

/** A retry of the owner: how its resume went and where the run stands after it was driven in place. */
export interface RetriedRun {
    /** How the resume went. */
    readonly resume: RetryResume
    /** Where the run stands, or null when it is gone. */
    readonly status: OptionalRunStatus
}

/** How an owner's answer ended. */
export type FreezeOutcome =
    /** The retry succeeded: the customer is released and the pending events were replayed. */
    | "released"
    /** The retry runs on (a wait, or the job took it): the customer is released once it ends well. */
    | "retrying"
    /** The retry failed again: the customer stays frozen and the item says so. */
    | "still_frozen"
    /** The turn was skipped: the customer is released and the pending events were replayed. */
    | "skipped"
    /** The owner holds the conversation; the customer stays frozen. */
    | "taken_over"
    /** The failed step cannot run again (its outcome is unknown): only skipping or taking over is left. */
    | "not_retryable"
    /** Nothing is frozen for this customer. */
    | "not_frozen"
    /**
     * The customer is held by the stop of a thread run: the founder answers the stop (its card on /chat or the run page), never the
     * freeze, and the customer is released when the stop closes.
     */
    | "on_stop"

/** Why a freeze released its customer: the retry ended well, the owner skipped the turn, or the thread run's stop closed. */
export type FreezeReleaseReason = "retried" | "skipped" | "stop_closed"

/** An open stop of a thread run, as a freeze reads it: whose it is and where it waits. */
export interface HeldStop {
    /** The run (the thread). */
    readonly runId: string
    /** The step that stopped. */
    readonly stepKey: string
    /** The agent of the run. */
    readonly agentId: string
    /** The workflow the run executes, or null for an agent's own graph. */
    readonly workflowId: string | null
    /** The customer, when the run names one. */
    readonly leadId: string | null
    /** The conversation of the run, when it has one. */
    readonly conversationId: string | null
    /** When it stopped, ISO text. */
    readonly stoppedAt: string
}

/** What the lead page and the run page read: whether the customer waits for the owner, and why. */
export interface FreezeState {
    /** The freeze. */
    readonly id: string
    /** Where it stands; a released freeze is never answered. */
    readonly status: Exclude<FreezeStatus, "released">
    /** The workflow whose run stopped, the only one the freeze holds; null for a freeze that holds the customer as a whole. */
    readonly workflowId: string | null
    /** The lead, when known. */
    readonly leadId: string | null
    /** The conversation, when known. */
    readonly conversationId: string | null
    /** The run that failed. */
    readonly runId: string | null
    /** The step's title. */
    readonly stepTitle: string | null
    /** The error code. */
    readonly reason: string | null
    /** The owner's item. */
    readonly workItemId: string | null
    /** How many events wait. */
    readonly pendingCount: number
    /** The person who took the conversation over, or null. */
    readonly heldBy: string | null
    /** When it froze, ISO text. */
    readonly frozenAt: string | null
    /** True when the stop of a thread run holds the customer: the stop is answered, not the freeze (no item, no retry here). */
    readonly onStop: boolean
}

/** One thing of a customer that waits for the founder: the step its workflow stopped on, and since when. */
export interface FreezeWaiting {
    /** The step the workflow stopped on, in the owner's words. */
    readonly step: string
    /** When it stopped, ISO text. */
    readonly since: string
}

/** What the pages read of a customer, or null when nothing holds them. */
export type OptionalFreezeState = FreezeState | null

/** A trigger scope as the freezes read it: plain members by name. */
export interface FreezeTrigger {
    /** One member by name. */
    readonly [member: string]: unknown
}
