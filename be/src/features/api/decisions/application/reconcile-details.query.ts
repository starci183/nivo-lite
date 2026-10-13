import { Query } from "@nestjs/cqrs"
import type { ReconcileDetails } from "@modules/domain/decisions"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ReconcileDetailsRequest } from "./reconcile-details.contracts"

/** Asks for the payment and the candidate invoices of a reconciliation. */
export class ReconcileDetailsQuery extends Query<ReconcileDetails> {
    constructor(readonly params: ExecuteParams<ReconcileDetailsRequest>) {
        super()
    }
}
