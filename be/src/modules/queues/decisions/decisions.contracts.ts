import type { Locale } from "@modules/platform/i18n"

/** The durable queue of the decisions: a person's decision, and the owner's Office commands. The name is the contract with the SQL that enqueues. */
export const DECISIONS_QUEUE = "decisions"

/** The jobs of the decisions queue; the value is the job name inside the queue and the prefix of the dedupe key. */
export enum DecisionsJob {
    /** Drains queued Sales steps through the policy gate. */
    RunWork = "decisions.run-work",
    /** A person approved or rejected a work item: the engine resumes the same work. */
    DecideWork = "decisions.decide-work",
    /** A person approved or rejected an approval card of a follow-up draft. */
    DecideExecution = "decisions.decide-execution",
    /** The owner wrote a message in the Office: the model proposes a command card for it. */
    ProposeCommand = "office.propose-command",
    /** The owner confirmed a command card: the command bus sends it. */
    ConfirmCommand = "office.confirm-command",
    /** The scheduler tick that drains the queued chain steps of every workspace through the policy gate. */
    DrainWork = "decisions.drain-work",
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

/** The payload of the propose-command job. */
export interface ProposeCommandPayload extends DecisionsJobScope {
    /** The owner message in the Office thread. */
    readonly messageId: string
}

/** The payload of the confirm-command job. */
export interface ConfirmCommandPayload extends DecisionsJobScope {
    /** The command card confirmed. */
    readonly candidateId: string
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null

const isScope = (value: Record<string, unknown>): boolean =>
    typeof value.workspaceId === "string" &&
    typeof value.userId === "string" &&
    (value.locale === "vi" || value.locale === "en")

const isVerdict = (value: unknown): boolean => value === "approved" || value === "rejected"

const isField = (value: unknown): boolean =>
    isRecord(value) &&
    typeof value.name === "string" &&
    (value.text === undefined || typeof value.text === "string") &&
    (value.number === undefined || typeof value.number === "number")

const isEdits = (value: unknown): value is QueuedEdits =>
    value === undefined ||
    value === null ||
    (isRecord(value) &&
        (value.draft === undefined || typeof value.draft === "string") &&
        (value.amount_vnd === undefined || value.amount_vnd === null || typeof value.amount_vnd === "number") &&
        (value.candidateId === undefined || typeof value.candidateId === "string") &&
        (value.fields === undefined || (Array.isArray(value.fields) && value.fields.every(isField))))

const isOptionalText = (value: unknown): boolean => value === undefined || value === null || typeof value === "string"

/** True when the value names an authorized queued work drain. */
export const isRunWorkPayload = (value: unknown): value is RunWorkPayload =>
    isRecord(value) &&
    isScope(value) &&
    typeof value.workItemId === "string" &&
    typeof value.requestId === "string" &&
    (value.intent === "retry" || value.intent === "handoff") &&
    !("decision" in value)

/** True when the value is the payload of a decide-work job. */
export const isDecideWorkPayload = (value: unknown): value is DecideWorkPayload =>
    isRecord(value) &&
    isScope(value) &&
    typeof value.workItemId === "string" &&
    isVerdict(value.decision) &&
    isEdits(value.edits) &&
    isOptionalText(value.note) &&
    isOptionalText(value.basis)

/** True when the value is the payload of a decide-execution job. */
export const isDecideExecutionPayload = (value: unknown): value is DecideExecutionPayload =>
    isRecord(value) &&
    isScope(value) &&
    typeof value.executionId === "string" &&
    isVerdict(value.decision) &&
    isOptionalText(value.editedDraft)

/** True when the value is the payload of a propose-command job. */
export const isProposeCommandPayload = (value: unknown): value is ProposeCommandPayload =>
    isRecord(value) && isScope(value) && typeof value.messageId === "string"

/** True when the value is the payload of a confirm-command job. */
export const isConfirmCommandPayload = (value: unknown): value is ConfirmCommandPayload =>
    isRecord(value) && isScope(value) && typeof value.candidateId === "string"

/** The dedupe key of a decisions job: one job per job name and subject, so a double click decides once. */
export const decisionsDedupeKey = (job: DecisionsJob, subject: string): string => `${job}:${subject}`
