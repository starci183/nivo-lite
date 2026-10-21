import type { AccountingWaitingWorkRow } from "@modules/domain/decisions"
import type { AccountingQuestionWorkView } from "./accounting-question-view.contracts"

/** Maps one waiting accounting question, retaining proposal fields as typed name/value pairs. */
export const toAccountingQuestionWorkView = (item: AccountingWaitingWorkRow): AccountingQuestionWorkView => ({
    id: item.id,
    workspaceId: item.workspace_id,
    department: item.department,
    action: item.action,
    subjectType: item.subject_type,
    subjectId: item.subject_id,
    leadId: item.lead_id,
    inboundEventId: item.inbound_event_id,
    parentId: item.parent_id,
    chainId: item.chain_id,
    depth: item.depth,
    status: item.status,
    decidedPath: item.decided_path,
    reason: item.reason,
    reasons: item.reasons,
    missingFields: item.missing_fields,
    proposal: {
        summary: item.proposal.summary,
        draft: item.proposal.draft ?? null,
        amountVnd: item.proposal.amount_vnd ?? null,
        confidence: item.proposal.confidence ?? null,
        outcome: item.proposal.outcome ?? null,
        fields: Object.entries(item.proposal.fields).map(([name, value]) => ({
            name,
            text: typeof value === "string" ? value : null,
            number: typeof value === "number" ? value : null,
        })),
        candidates: (item.proposal.candidates ?? []).map((candidate) => ({
            id: candidate.id,
            label: candidate.label,
            amountVnd: candidate.amount_vnd,
        })),
    },
    result: item.result === null ? null : { summary: item.result.summary, href: item.result.href ?? null },
    error: item.error,
    evidenceState: item.evidence_state,
    assignedStaffId: item.assigned_staff_id,
    assignedStaffName: item.assigned_staff_name,
    executionId: item.execution_id,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
    completedAt: item.completed_at,
    installationId: item.installation_id,
    lead:
        item.lead === null
            ? null
            : {
                  id: item.lead.id,
                  contactName: item.lead.contact_name,
                  company: item.lead.company,
                  channel: item.lead.channel,
              },
})
