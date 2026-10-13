import { Query } from "@nestjs/cqrs"
import type { PayableOrder } from "@modules/domain/billing"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { GetOrderRequest } from "./get-order.contracts"

/** Asks for one payment order of the caller's workspace with the QR that pays it. */
export class GetOrderQuery extends Query<PayableOrder> {
    constructor(readonly params: ExecuteParams<GetOrderRequest>) {
        super()
    }
}
