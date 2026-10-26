import { cardOf } from "./office.rooms"
import type { OfficeApproval, OfficeAuthorKind, OfficeCandidate, OfficeMessage, OfficeWork } from "./office.types"

const AUTHOR_KINDS: ReadonlyArray<OfficeAuthorKind> = ["human", "agent", "system"]
const APPROVAL_STATUSES: ReadonlyArray<OfficeApproval["status"]> = ["pending_approval", "approved", "rejected"]
const CANDIDATE_STATUSES: ReadonlyArray<OfficeCandidate["status"]> = ["pending", "sent", "cancelled"]

/** The wire line of the back end `officeMessages` query. */
interface MessageWire {
    readonly id: string
    readonly author_kind: string
    readonly author_name: string
    readonly body: string
    readonly created_at: string
    readonly agent_id?: string | null
    readonly lead_id?: string | null
    readonly work_item_id?: string | null
    readonly room?: string | null
    readonly card_json?: string | null
    readonly card_state?: string | null
}

/** One back end line as the thread uses it. */
export const toOfficeMessage = (row: MessageWire): OfficeMessage => ({
    id: row.id,
    authorKind: AUTHOR_KINDS.find((kind) => kind === row.author_kind) ?? "system",
    authorName: row.author_name,
    body: row.body,
    createdAt: row.created_at,
    agentId: row.agent_id ?? null,
    leadId: row.lead_id ?? null,
    workItemId: row.work_item_id ?? null,
    room: row.room ?? null,
    card: cardOf(row.card_json),
    cardState: row.card_state ?? null,
    receipt: null,
})

/** The wire line of the back end approval queries. */
interface ApprovalWire {
    readonly id: string
    readonly status: string
    readonly draft: string
    readonly created_at: string
    readonly decided_at?: string | null
    readonly decided_by?: string | null
    readonly agent_id?: string | null
    readonly agentName?: string | null
    readonly assignedStaffId?: string | null
    readonly channel: string
    readonly leadId?: string | null
    readonly leadName?: string | null
    readonly nextAction: string
}

/** One back end approval as the thread uses it: a status outside the set reads as settled. */
export const toOfficeApproval = (row: ApprovalWire): OfficeApproval => ({
    id: row.id,
    status: APPROVAL_STATUSES.find((status) => status === row.status) ?? "rejected",
    draft: row.draft,
    createdAt: row.created_at,
    decidedAt: row.decided_at ?? null,
    decidedBy: row.decided_by ?? null,
    agentId: row.agent_id ?? null,
    agentName: row.agentName ?? null,
    assignedStaffId: row.assignedStaffId ?? null,
    channel: row.channel,
    leadId: row.leadId ?? null,
    leadName: row.leadName ?? null,
    nextAction: row.nextAction,
})

/** The wire card of the back end `officeCommandCandidates` query. */
interface CandidateWire {
    readonly id: string
    readonly message_id: string
    readonly module: string
    readonly command: string
    readonly summary: string
    readonly status: string
    readonly refusal_detail?: string | null
    readonly work_item_id?: string | null
    readonly shown: ReadonlyArray<{ readonly key: string; readonly label: string; readonly value: string }>
}

/** One back end command card as the thread uses it. */
export const toOfficeCandidate = ({
    id,
    message_id: messageId,
    module,
    command,
    summary,
    status: wireStatus,
    refusal_detail: refusal,
    work_item_id: workItemId,
    shown,
}: CandidateWire): OfficeCandidate => ({
    id,
    messageId,
    module,
    command,
    summary,
    status: CANDIDATE_STATUSES.find((status) => status === wireStatus) ?? "cancelled",
    refusal: refusal ?? null,
    workItemId: workItemId ?? null,
    shown,
})

/** The wire work item of the back end `workItems` query. */
interface WorkWire {
    readonly id: string
    readonly action: string
    readonly department: string
    readonly status: string
    readonly reason?: string | null
    readonly error?: string | null
    readonly created_at: string
    readonly updated_at: string
    readonly completed_at?: string | null
    readonly assigned_staff_id?: string | null
    readonly lead_id?: string | null
    readonly execution_id?: string | null
    readonly decided_path?: string | null
    readonly missing_fields: ReadonlyArray<string>
    readonly proposal: {
        readonly summary: string
        readonly draft?: string | null
        readonly amount_vnd?: number | null
        readonly fields: unknown
        readonly candidates?: ReadonlyArray<{
            readonly id: string
            readonly label: string
            readonly amount_vnd: number
        }> | null
    }
    readonly result?: { readonly summary: string } | null
}

/** One back end work item as the exception cards use it. */
export const toOfficeWork = (row: WorkWire): OfficeWork => ({
    id: row.id,
    action: row.action,
    department: row.department,
    status: row.status,
    reason: row.reason ?? null,
    error: row.error ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at ?? null,
    assignedStaffId: row.assigned_staff_id ?? null,
    leadId: row.lead_id ?? null,
    executionId: row.execution_id ?? null,
    decidedPath: row.decided_path ?? null,
    missingFields: row.missing_fields,
    summary: row.proposal.summary,
    draft: row.proposal.draft ?? null,
    amountVnd: row.proposal.amount_vnd ?? null,
    candidates: (row.proposal.candidates ?? []).map((c) => ({ id: c.id, label: c.label, amountVnd: c.amount_vnd })),
    fields: row.proposal.fields,
    resultSummary: row.result?.summary ?? null,
})
