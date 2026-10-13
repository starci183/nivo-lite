import type { SalesAction } from "@modules/domain/sales"
import type { SalesActionStatusRequest } from "../../application/sales-action-status.contracts"
import type { SalesActionStatusInput } from "./dto/sales-action-status.input"
import type { SalesActionType } from "./dto/sales-action.type"

/** Scopes the status read to the authenticated caller's selected workspace. */
export const toSalesActionStatusRequest = (
    workspaceId: string,
    input: SalesActionStatusInput,
): SalesActionStatusRequest => ({ workspaceId, id: input.id })

/** Maps queued Sales progress without exposing generated prose. */
export const toSalesActionStatusType = (result: SalesAction): SalesActionType => ({
    id: result.id,
    status: result.status,
    workItemId: result.workItemId,
    errorCode: result.errorCode,
})
