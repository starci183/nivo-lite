import { Query } from "@nestjs/cqrs"
import type { PayableOrder } from "@modules/domain/billing"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { GetOpenOrderRequest } from "./get-open-order.contracts"

/** Asks for the newest plan payment of the caller's workspace that can still be paid, if any. */
export class GetOpenOrderQuery extends Query<PayableOrder | null> {
    constructor(readonly params: ExecuteParams<GetOpenOrderRequest>) {
        super()
    }
}
