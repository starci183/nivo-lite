import type { SalesWorkbenchData } from "@modules/domain/sales-workbench"
import type { ReadSalesWorkbenchRequest } from "../../application/read-sales-workbench.contracts"
import type { SalesWorkbenchType } from "./dto/sales-workbench.type"

/** Selects the workspace supplied by the transport header. */
export const toSalesWorkbenchRequest = (workspaceId: string): ReadSalesWorkbenchRequest => ({ workspaceId })

/** Maps the derived regions and decision-log column names into the GraphQL contract. */
export const toSalesWorkbenchType = (result: SalesWorkbenchData): SalesWorkbenchType => ({
    ...result,
    decided: result.decided.map((decision) => ({
        id: decision.id,
        workItemId: decision.work_item_id,
        leadId: decision.lead_id,
        leadName: decision.leadName,
        department: decision.department,
        action: decision.action,
        decidedBy: decision.decided_by,
        deciderKind: decision.decider_kind,
        outcome: decision.outcome,
        reason: decision.reason,
        note: decision.note,
        createdAt: decision.created_at,
    })),
})
