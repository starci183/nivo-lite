import type { EntityManager } from "typeorm"
import { ApprovalRequestEntity } from "@modules/domain/approval-requests"
import { eventsEntities } from "@modules/domain/events"
import { WorkItemEntity } from "@modules/domain/work-items"

const [EventEntity] = eventsEntities

/** The most rows one proof read takes; the proofs seed far fewer. */
const PROOF_ROWS_MAX = 1000

/** The state of an approval request as the sweep and the decisions left it. */
export interface ApprovalRequestState {
    /** Where the request stands. */
    readonly status: string
    /** The member who resolved it, if any. */
    readonly resolved_by: string | null
    /** The member it escalated to, if any. */
    readonly escalated_to: string | null
    /** How many verdicts it holds. */
    readonly verdicts: number
}

/** The evidence of one event line. */
export interface EventEvidenceRow {
    /** The one-line summary of the event. */
    readonly summary: string
    /** The evidence text the event carries. */
    readonly evidence: string
}

/** One work item of a customer thread. */
export interface ThreadWorkItemState {
    /** The action the item carries. */
    readonly action: string
    /** Its lifecycle status. */
    readonly status: string
    /** How it was decided. */
    readonly decided_path: string | null
    /** The tax code its proposal carries. */
    readonly tax_code: string | null
}

/** Reads one approval request with how many verdicts it holds, or undefined when it is gone. */
export const approvalRequestState = async (
    manager: EntityManager,
    requestId: string,
): Promise<ApprovalRequestState | undefined> => {
    const row = await manager.findOneBy(ApprovalRequestEntity, { id: requestId })
    if (row === null) return undefined
    return {
        status: row.status,
        resolved_by: row.resolvedBy,
        escalated_to: row.escalatedTo,
        verdicts: row.verdicts.length,
    }
}

/** Moves the deadline of a request into the past so the next sweep expires it. */
export const expireApprovalRequestNow = async (manager: EntityManager, requestId: string): Promise<void> => {
    await manager.update(ApprovalRequestEntity, { id: requestId }, { expiresAt: () => "now() - interval '1 minute'" })
}

/** The evidence lines of a workspace of one kind. */
export const eventsOfKind = async (
    manager: EntityManager,
    workspaceId: string,
    kind: string,
): Promise<Array<EventEvidenceRow>> => {
    const rows = await manager.find(EventEntity, { where: { workspaceId, kind }, take: PROOF_ROWS_MAX })
    return rows.map((row) => ({ summary: row.summary, evidence: row.evidence ?? "" }))
}

/** The work items of a customer in a workspace, oldest first, with the tax code their proposal carries. */
export const workItemsOfThread = (
    manager: EntityManager,
    workspaceId: string,
    leadId: string,
): Promise<Array<ThreadWorkItemState>> =>
    manager
        .createQueryBuilder(WorkItemEntity, "w")
        .select("w.action", "action")
        .addSelect("w.status", "status")
        .addSelect("w.decided_path", "decided_path")
        .addSelect("w.proposal -> 'fields' ->> 'tax_code'", "tax_code")
        .where("w.workspace_id = :workspaceId AND w.lead_id = :leadId", { workspaceId, leadId })
        .orderBy("w.created_at")
        .addOrderBy("w.id")
        .getRawMany<ThreadWorkItemState>()
