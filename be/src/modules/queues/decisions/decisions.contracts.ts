import type { Locale } from "@modules/platform/i18n"

/** The durable queue of the decisions: a person's decision, the approval deadlines and the agent graph watch. The name is the contract with the SQL that enqueues. */
export const DECISIONS_QUEUE = "decisions"

/** The jobs of the decisions queue; the value is the job name inside the queue and the prefix of the dedupe key. */
export enum DecisionsJob {
    /** Drains queued Sales steps through the policy gate. */
    RunWork = "decisions.run-work",
    /** A person approved or rejected a work item: the engine resumes the same work. */
    DecideWork = "decisions.decide-work",
    /** A person approved or rejected an approval card of a follow-up draft. */
    DecideExecution = "decisions.decide-execution",
    /** The scheduler tick that expires the requests for approval whose time ran out and reminds the half-way ones. */
    ExpireApprovals = "decisions.expire-approvals",
    /** The scheduler tick that seeds the graphs of agents that have none, raises what ended decisions teach and compares the Brain rules behind the graphs. */
    AgentGraphWatch = "decisions.agent-graph-watch",
}

/** A queued Sales step to process, plus the identity of this retry. */
export interface RunWorkPayload extends DecisionsJobScope {
    /** Retry requires decision permission; handoff starts Accounting's gated invoice action. */
    readonly intent: "retry" | "handoff"
    /** The step the caller may retry. */
    readonly workItemId: string
    /** The fresh request identity, so later retries enqueue again. */
    readonly requestId: string
}

/** One field a person changed before approving. */
export interface QueuedField {
    /** The field name. */
    readonly name: string
    /** The new text value. */
    readonly text?: string
    /** The new number value. */
    readonly number?: number
}

/** What a person changed before approving a work item. */
export interface QueuedEdits {
    /** A new draft. */
    readonly draft?: string
    /** A new amount, VND; null clears it. */
    readonly amount_vnd?: number | null
    /** Changed fields. */
    readonly fields?: ReadonlyArray<QueuedField>
    /** The invoice the person chose among the candidates. */
    readonly candidateId?: string
}

/** What every decisions job carries: who asked (the Auth user the database checked), for which workspace, in which language. */
export interface DecisionsJobScope {
    /** The workspace the caller proved membership in. */
    readonly workspaceId: string
    /** The Auth user who asked; the domain service proves their role again. */
    readonly userId: string
    /** The language of the generated text. */
    readonly locale: Locale
}

/** The payload of the decide-work job. */
export interface DecideWorkPayload extends DecisionsJobScope {
    /** The work item decided. */
    readonly workItemId: string
    /** Approved or rejected. */
    readonly decision: "approved" | "rejected"
    /** What the person changed before approving. */
    readonly edits?: QueuedEdits | null | undefined
    /** A note of the person. */
    readonly note?: string | null | undefined
    /** The written basis of a verified payment. */
    readonly basis?: string | null | undefined
}

/** The payload of the decide-execution job. */
export interface DecideExecutionPayload extends DecisionsJobScope {
    /** The approval card decided. */
    readonly executionId: string
    /** Approved or rejected. */
    readonly decision: "approved" | "rejected"
    /** The draft as the person edited it. */
    readonly editedDraft?: string | null | undefined
}

/** The dedupe key of a decisions job: one job per job name and subject, so a double click decides once. */
export const decisionsDedupeKey = (job: DecisionsJob, subject: string): string => `${job}:${subject}`
