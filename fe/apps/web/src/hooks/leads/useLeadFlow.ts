import { useQueryLeadFlowSwr } from "@/hooks/swr"
import { useActiveWorkspace } from "@/hooks/workspaces"
import type { SWRResponse } from "swr"

/** The work flow of one lead (steps, decisions, orders, invoices, transactions) read through the shared SWR cache; `undefined` pauses it. */
export const useLeadFlow = (
    leadId: string | undefined,
): SWRResponse<{
    decisions: Array<{
        action: string
        createdAt: string
        decidedBy: string
        deciderKind: string
        department: string
        id: string
        leadId: string | null
        leadName: string | null
        note: string | null
        outcome: string
        reason: string | null
        workItemId: string | null
    }>
    invoices: Array<{
        amountVnd: number
        createdAt: string
        dueAt: string | null
        id: string
        invoiceNo: string
        issuedAt: string | null
        issuedBy: string | null
        leadId: string | null
        orderId: string | null
        paidAt: string | null
        status: string
        workspaceId: string
    }>
    orders: Array<{
        amountVnd: number | null
        carrier: string | null
        confirmedAt: string | null
        confirmedBy: string | null
        createdAt: string
        id: string
        inboundEventId: string | null
        items: string
        leadId: string | null
        orderNo: string
        shippedAt: string | null
        status: string
        trackingCode: string | null
        workspaceId: string
    }>
    transactions: Array<{
        amountVnd: number
        channel: string
        createdAt: string
        id: string
        inboundEventId: string | null
        invoiceId: string | null
        occurredAt: string
        payer: string | null
        reference: string | null
        status: string
        workspaceId: string
    }>
    workItems: Array<{
        action: string
        assignedStaffId: string | null
        assignedStaffName: string | null
        chainId: string | null
        completedAt: string | null
        createdAt: string
        decidedBy: string | null
        decidedPath: string | null
        department: string
        depth: number
        error: string | null
        evidenceState: string
        executionId: string | null
        hasApprovalCard: boolean
        href: string
        id: string
        inboundEventId: string | null
        installationId: string | null
        leadId: string | null
        missingFields: Array<string>
        parentId: string | null
        reason: string | null
        reasons: Array<string>
        status: string
        subjectId: string | null
        subjectType: string
        updatedAt: string
        workspaceId: string
        lead: {
            channel: string
            company: string
            contactName: string
            id: string
        } | null
        proposal: {
            amountVnd: number | null
            confidence: number | null
            draft: string | null
            outcome: string | null
            summary: string
            candidates: Array<{
                amountVnd: number
                id: string
                label: string
            }> | null
            fields: Array<{
                key: string
                kind: string
                numberValue: number | null
                stringValue: string | null
            }>
        }
        result: {
            href: string | null
            summary: string
        } | null
    }>
}> => {
    const { activeWorkspaceId } = useActiveWorkspace()
    return useQueryLeadFlowSwr(activeWorkspaceId, leadId)
}
