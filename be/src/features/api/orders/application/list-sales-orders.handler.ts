import { QueryHandler } from "@nestjs/cqrs"
import { OrdersReadService } from "@modules/domain/orders"
import type { SalesOrderView } from "@modules/domain/orders"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ListSalesOrdersQuery } from "./list-sales-orders.query"

@QueryHandler(ListSalesOrdersQuery)
/** Proves membership before listing the selected workspace's orders. */
export class ListSalesOrdersHandler extends ICQRSHandler<ListSalesOrdersQuery, Array<SalesOrderView>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly orders: OrdersReadService,
    ) {
        super(logger)
    }

    protected override process(query: ListSalesOrdersQuery): Promise<Array<SalesOrderView>> {
        return this.orders.list(query.params.principal.id, query.params.request.workspaceId)
    }
}
