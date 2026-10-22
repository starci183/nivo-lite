import type { ChainStep, ChainStepKind, ChainStepStatus, MentionRef } from "./work-chains.contracts"
import type { ChainStepRow } from "./persistence/work-chains.rows"

const KINDS: ReadonlyArray<ChainStepKind> = ["self", "ask_approval", "hand_off", "assign"]
const STATUSES: ReadonlyArray<ChainStepStatus> = ["waiting", "done", "rejected", "expired", "stopped"]
const MENTION_KINDS: ReadonlyArray<MentionRef["kind"]> = ["member", "agent", "group"]

const kindOf = (value: string): ChainStepKind => KINDS.find((kind) => kind === value) ?? "self"

const statusOf = (value: string): ChainStepStatus => STATUSES.find((status) => status === value) ?? "done"

const targetOf = (target: ChainStepRow["target"]): MentionRef | null => {
    if (target === null) return null
    const kind = MENTION_KINDS.find((candidate) => candidate === target.kind)
    return kind === undefined ? null : { kind, id: target.id }
}

/** One step row as the panel reads it: the stored words narrowed to the step vocabulary, instants as ISO 8601. */
export const toChainStep = (row: ChainStepRow): ChainStep => ({
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
    startedAt: new Date(row.started_at).toISOString(),
    finishedAt: row.finished_at === null ? null : new Date(row.finished_at).toISOString(),
})
