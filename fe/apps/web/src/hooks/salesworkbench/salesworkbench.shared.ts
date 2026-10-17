import { DEAL_STAGES } from "@/hooks/sales"
import type { SalesWorkbenchType } from "@/hooks/swr"
import { isActionKey, isModuleKey } from "@/modules/catalog"
import type { AttentionKind, FlowDecisionRow, LeadStageId, SalesWorkbenchData } from "@/modules/types"

const reasonOf = (value: string | null | undefined): FlowDecisionRow["reason"] =>
    value === "routine" ||
    value === "missing_data" ||
    value === "over_authority" ||
    value === "unclear_outcome" ||
    value === "not_allowed"
        ? value
        : null
const actionOf = (value: string) => (isActionKey(value) ? value : "classify_lead")
const stageOf = (value: string): LeadStageId => DEAL_STAGES.find((stage) => stage === value) ?? "new"
const attentionOf = (value: string): AttentionKind =>
    value === "failed" || value === "clarify" || value === "overdue" || value === "awaiting_reply" ? value : "decision"

/** Maps the generated Sales result into the workbench's display model. */
export const salesWorkbenchViewOf = (data: SalesWorkbenchType): SalesWorkbenchData => ({
    nowIso: data.nowIso,
    metrics: data.metrics,
    closedHidden: data.closedHidden,
    staff: data.staff,
    leadOptions: data.leadOptions,
    attention: data.attention.map((row) => ({
        ...row,
        kind: attentionOf(row.kind),
        leadId: row.leadId ?? null,
        stage: row.stage ? stageOf(row.stage) : null,
        owner: row.owner ?? null,
        workItemId: row.workItemId ?? null,
        decisionId: row.decisionId ?? null,
        action: row.action ? actionOf(row.action) : null,
    })),
    deals: data.deals.map((row) => ({
        ...row,
        stage: stageOf(row.stage),
        valueVnd: row.valueVnd ?? null,
        valueSource: row.valueSource === "order" || row.valueSource === "quote" ? row.valueSource : null,
        nextStep: row.nextStep ?? null,
        dueAt: row.dueAt ?? null,
        owner: row.owner ?? null,
        closedReason: row.closedReason ?? null,
        closedAt: row.closedAt ?? null,
    })),
    decisions: data.decisions.map((row) => ({
        ...row,
        source: row.source === "execution" ? "execution" : "work_item",
        workItemId: row.workItemId ?? null,
        executionId: row.executionId ?? null,
        leadId: row.leadId ?? null,
        action: row.action === "follow_up" ? "follow_up" : actionOf(row.action),
        reason: reasonOf(row.reason),
        amountVnd: row.amountVnd ?? null,
        assignedStaffId: row.assignedStaffId ?? null,
        assignedStaffName: row.assignedStaffName ?? null,
    })),
    decided: data.decided.map(decidedRowMapper()),
    handoffs: data.handoffs.map(handoffRowMapper()),
    activity: data.activity.map((row) => ({
        ...row,
        action: actionOf(row.action),
        leadId: row.leadId ?? null,
        customer: row.customer ?? null,
        evidence: row.evidence ?? null,
        evidenceState:
            row.evidenceState === "captured" ||
            row.evidenceState === "reviewed" ||
            row.evidenceState === "verified" ||
            row.evidenceState === "customer_confirmed"
                ? row.evidenceState
                : "pending",
    })),
    contracts: data.contracts.map((row) => ({
        id: row.id,
        lead_id: row.leadId ?? null,
        customer_name: row.customerName,
        plan: row.plan,
        starts_on: row.startsOn,
        ends_on: row.endsOn,
        amount_vnd: row.amountVnd ?? null,
        status: row.status === "ended" || row.status === "cancelled" ? row.status : "active",
        note: row.note,
    })),
})

const decidedRowMapper = (): ((
    row: SalesWorkbenchType["decided"][number],
) => SalesWorkbenchData["decided"][number]) => {
    return (row) => ({
        id: row.id,
        work_item_id: row.workItemId ?? null,
        lead_id: row.leadId ?? null,
        leadName: row.leadName ?? null,
        department: isModuleKey(row.department) ? row.department : "sales",
        action: actionOf(row.action),
        decided_by: row.decidedBy,
        decider_kind: row.deciderKind === "policy" || row.deciderKind === "staff" ? row.deciderKind : "owner",
        outcome:
            row.outcome === "auto_done" || row.outcome === "edited" || row.outcome === "rejected"
                ? row.outcome
                : "approved",
        reason: reasonOf(row.reason),
        note: row.note ?? null,
        created_at: row.createdAt,
    })
}

const handoffRowMapper = (): ((
    row: SalesWorkbenchType["handoffs"][number],
) => SalesWorkbenchData["handoffs"][number]) => {
    return (row) => ({
        ...row,
        orderId: row.orderId ?? null,
        leadId: row.leadId ?? null,
        orderNo: row.orderNo ?? null,
        amountVnd: row.amountVnd ?? null,
        orderStatus:
            row.orderStatus === "draft" ||
            row.orderStatus === "invoiced" ||
            row.orderStatus === "paid" ||
            row.orderStatus === "cancelled" ||
            row.orderStatus === "won_without_order"
                ? row.orderStatus
                : "confirmed",
        confirmedAt: row.confirmedAt ?? null,
        invoice: row.invoice
            ? {
                  ...row.invoice,
                  status:
                      row.invoice.status === "issued" || row.invoice.status === "paid" || row.invoice.status === "void"
                          ? row.invoice.status
                          : "draft",
                  issuedAt: row.invoice.issuedAt ?? null,
                  paidAt: row.invoice.paidAt ?? null,
              }
            : null,
        work: row.work
            ? {
                  ...row.work,
                  status:
                      row.work.status === "done" ||
                      row.work.status === "waiting_decision" ||
                      row.work.status === "rejected" ||
                      row.work.status === "failed"
                          ? row.work.status
                          : "queued",
                  reason: reasonOf(row.work.reason),
                  error: row.work.error ?? null,
              }
            : null,
        shippedAt: row.shippedAt ?? null,
        carrier: row.carrier ?? null,
        trackingCode: row.trackingCode ?? null,
    })
}
