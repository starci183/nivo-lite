import { Query } from "@nestjs/cqrs"
import type { SalesOrderView } from "@modules/domain/orders"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { Connection } from "@modules/platform/pagination"
import type { ListSalesOrdersRequest } from "./list-sales-orders.contracts"

/** Asks for the workspace's newest sales orders. */
export class ListSalesOrdersQuery extends Query<Connection<SalesOrderView>> {
    constructor(readonly params: ExecuteParams<ListSalesOrdersRequest>) {
        super()
    }
}
