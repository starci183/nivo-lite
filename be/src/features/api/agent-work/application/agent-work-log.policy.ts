import type { BoundConnection, Purpose } from "@modules/domain/agent-connections"
import type { WorkItem } from "@modules/domain/work-items"
import type {
    WorkLogConnection,
    WorkLogEvidence,
    WorkLogLevel,
    WorkLogLine,
    WorkLogStatus,
    WorkLogStep,
} from "./read-agent-work-log.contracts"

/** The field of a proposal that carries the code of a payment. */
const REFERENCE_FIELD = "reference"

/** What a grant is for, by the kind of record the work is about; a kind with no entry has no connection to name. */
const PURPOSE_OF_SUBJECT: Readonly<Record<string, Purpose>> = {
    transaction: "bank_feed",
    conversation: "inbound_chat",
    inbound: "inbound_chat",
    lead: "inbound_chat",
}

const STATUS: Readonly<Record<WorkItem["status"], WorkLogStatus>> = {
    queued: "queued",
    waiting_decision: "waiting",
    done: "done",
    rejected: "rejected",
    failed: "failed",
}

/** How the item was decided: by policy alone is the agent's own doing, by a person is a question the agent asked first. */
export const levelOf = (item: WorkItem): WorkLogLevel | null => {
    if (item.decided_path === "auto") return "auto"
    return item.decided_path === "human" ? "ask" : null
}

/** The one connection the agent holds for what the work is about, or null when it holds none or several (a guess would mislead). */
export const connectionOf = (item: WorkItem, grants: ReadonlyArray<BoundConnection>): WorkLogConnection | null => {
    const purpose = PURPOSE_OF_SUBJECT[item.subject_type]
    if (purpose === undefined) return null
    const matching = grants.filter((grant) => grant.purpose === purpose)
    const only = matching.length === 1 ? matching[0] : undefined
    return only === undefined ? null : { id: only.id, name: only.name, provider: only.provider }
}

/** What the proposal carried as evidence: the entries whose value was read, as text. */
export const evidenceOf = (item: WorkItem): ReadonlyArray<WorkLogEvidence> =>
    (item.proposal.evidence ?? []).flatMap((entry) =>
        entry.value === null ? [] : [{ key: entry.key, value: String(entry.value) }],
    )

/** The payment reference of the proposal, or null. */
export const evidenceCodeOf = (item: WorkItem): string | null => {
    const code = item.proposal.fields[REFERENCE_FIELD]
    return typeof code === "string" && code !== "" ? code : null
}

/** The steps the record of the item tells: raised, asked, decided by a person, closed. */
export const stepsOf = (item: WorkItem): ReadonlyArray<WorkLogStep> => {
    const isOpen = item.status === "queued" || item.status === "waiting_decision"
    const isBad = item.status === "failed" || item.status === "rejected"
    const raised: WorkLogStep = { key: "raised", at: item.created_at, state: "done" }
    const gate: ReadonlyArray<WorkLogStep> =
        item.reason === null || item.reason === "routine"
            ? []
            : [{ key: "gate", at: null, state: item.status === "waiting_decision" ? "current" : "done" }]
    const decided: ReadonlyArray<WorkLogStep> =
        item.decided_path === "human" ? [{ key: "decided", at: null, state: isOpen ? "current" : "done" }] : []
    const closed: WorkLogStep = { key: "closed", at: item.completed_at, state: isOpen ? "current" : "done" }
    return [raised, ...gate, ...decided, isBad ? { ...closed, state: "failed" } : closed]
}

/** One work item as a line of the log. */
export const logLineOf = (item: WorkItem, grants: ReadonlyArray<BoundConnection>): WorkLogLine => {
    const proposed = item.proposal.summary
    const title = item.result?.summary ?? proposed
    return {
        id: item.id,
        action: item.action,
        at: item.completed_at ?? item.created_at,
        title,
        detail: proposed === title ? "" : proposed,
        status: STATUS[item.status],
        level: levelOf(item),
        connection: connectionOf(item, grants),
        evidenceKind: item.subject_type,
        evidenceCode: evidenceCodeOf(item),
        evidence: evidenceOf(item),
        reason: item.reason,
        steps: stepsOf(item),
        resultHref: item.result?.href ?? null,
        error: item.error,
    }
}
