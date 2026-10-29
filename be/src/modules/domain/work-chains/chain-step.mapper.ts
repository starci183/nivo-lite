import { isRecord } from "@modules/platform/primitives"
import type { ChainStep, ChainStepKind, ChainStepRecord, ChainStepStatus, MentionRef } from "./work-chains.contracts"

const KINDS: ReadonlyArray<ChainStepKind> = ["self", "ask_approval", "hand_off", "assign"]
const STATUSES: ReadonlyArray<ChainStepStatus> = ["waiting", "done", "rejected", "expired", "stopped"]
const MENTION_KINDS: ReadonlyArray<MentionRef["kind"]> = ["member", "agent", "group"]

const kindOf = (value: string): ChainStepKind => KINDS.find((kind) => kind === value) ?? "self"

const statusOf = (value: string): ChainStepStatus => STATUSES.find((status) => status === value) ?? "done"

const targetOf = (target: ChainStepRecord["target"]): MentionRef | null => {
    if (target === null) return null
    const kind = MENTION_KINDS.find((candidate) => candidate === target.kind)
    return kind === undefined ? null : { kind, id: target.id }
}

/** One step row as the panel reads it: the stored words narrowed to the step vocabulary, instants as ISO 8601. */
export const toChainStep = (row: ChainStepRecord): ChainStep => ({
    id: row.id,
    seq: row.seq,
    actor: { kind: row.actor_kind === "agent" ? "agent" : "member", id: row.actor_id },
    actorName: row.actor_name,
    actorRole: row.actor_role,
    kind: kindOf(row.kind),
    action: row.action,
    detail: row.detail,
    rule: row.rule,
    target: targetOf(row.target),
    approvalRequestId: row.approval_request_id,
    status: statusOf(row.status),
    decidedBy: row.decided_by,
    startedAt: row.started_at.toISOString(),
    finishedAt: row.finished_at === null ? null : row.finished_at.toISOString(),
})

/** The thread and action of the first step a RETURNING write settled; undefined when it settled none. */
export interface SettledStep {
    /** The thread the step belongs to. */
    readonly thread_id: string
    /** What the step did. */
    readonly action: string
}

const isSettledStep = (value: unknown): value is SettledStep =>
    isRecord(value) && typeof value.thread_id === "string" && typeof value.action === "string"

/** The first step a RETURNING write settled. */
export const firstSettledStep = (raw: unknown): SettledStep | undefined =>
    Array.isArray(raw) ? raw.find(isSettledStep) : undefined

const isIdRow = (value: unknown): value is { readonly id: string } => isRecord(value) && typeof value.id === "string"

/** The id of the first row a RETURNING write answered; undefined when it answered none. */
export const firstReturnedId = (raw: unknown): string | undefined =>
    Array.isArray(raw) ? raw.find(isIdRow)?.id : undefined
