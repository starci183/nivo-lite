import type { Locale } from "@modules/platform/i18n"

/** The pgmq queue of the decisions: a person's decision, and the owner's Office commands. The name is the contract with the SQL that enqueues. */
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
    /** An owner-created simulated inbound event follows the same department work engine as live inputs. */
    SimulateInbound = "inbox.simulate-inbound",
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
    readonly edits?: QueuedEdits | null
    /** A note of the person. */
    readonly note?: string | null
    /** The written basis of a verified payment. */
    readonly basis?: string | null
}

/** The payload of the decide-execution job. */
export interface DecideExecutionPayload extends DecisionsJobScope {
    /** The approval card decided. */
    readonly executionId: string
    /** Approved or rejected. */
    readonly decision: "approved" | "rejected"
    /** The draft as the person edited it. */
    readonly editedDraft?: string | null
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

/** The payload of a simulated-input job; the stored event supplies every customer field. */
export interface SimulateInboundPayload extends DecisionsJobScope {
    /** Discriminates this payload from decisions and Office commands on the same queue. */
    readonly kind: "simulate_inbound"
    /** The input recorded in the same transaction as this job. */
    readonly inboundEventId: string
    /** The order's item description, which the inbound table has no column for. */
    readonly items: string
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

/** True when the value is a simulated-input payload. */
export const isSimulateInboundPayload = (value: unknown): value is SimulateInboundPayload =>
    isRecord(value) &&
    isScope(value) &&
    value.kind === "simulate_inbound" &&
    typeof value.inboundEventId === "string" &&
    typeof value.items === "string"

/** The dedupe key of a decisions job: one job per job name and subject, so a double click decides once. */
export const decisionsDedupeKey = (job: DecisionsJob, subject: string): string => `${job}:${subject}`
