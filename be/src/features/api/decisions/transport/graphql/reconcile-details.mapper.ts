import type { ReconcileDetails } from "@modules/domain/decisions"
import type { ReconcileDetailsRequest } from "../../application/reconcile-details.contracts"
import type { ReconcileDetailsArgs } from "./dto/reconcile-details.args"
import type { ReconcileDetailsType } from "./dto/reconcile-details.type"

/** Maps the reconciliation arguments, with the workspace they name, to the query request. */
export const toReconcileDetailsRequest = (
    workspaceId: string,
    args: ReconcileDetailsArgs,
): ReconcileDetailsRequest => ({
    workspaceId,
    workItemId: args.workItemId,
})

/** Maps the reconciliation to the GraphQL type. */
export const toReconcileDetailsType = (details: ReconcileDetails): ReconcileDetailsType => ({ ...details })
