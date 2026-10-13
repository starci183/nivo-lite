import { Query } from "@nestjs/cqrs"
import type { SalesAction } from "@modules/domain/sales"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SalesActionStatusRequest } from "./sales-action-status.contracts"

/** Asks for the progress of one queued Sales action. */
export class SalesActionStatusQuery extends Query<SalesAction> {
    constructor(readonly params: ExecuteParams<SalesActionStatusRequest>) {
        super()
    }
}
