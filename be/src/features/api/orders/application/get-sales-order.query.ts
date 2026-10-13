import { Query } from "@nestjs/cqrs"
import type { SalesOrderViewLookup } from "@modules/domain/orders"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { GetSalesOrderRequest } from "./get-sales-order.contracts"

/** Asks for a workspace-scoped sales order. */
export class GetSalesOrderQuery extends Query<SalesOrderViewLookup> {
    constructor(readonly params: ExecuteParams<GetSalesOrderRequest>) {
        super()
    }
}
