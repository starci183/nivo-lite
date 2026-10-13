import { QueryHandler } from "@nestjs/cqrs"
import { OrdersReadService } from "@modules/domain/orders"
import type { SalesOrderViewLookup } from "@modules/domain/orders"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { GetSalesOrderQuery } from "./get-sales-order.query"

@QueryHandler(GetSalesOrderQuery)
/** Proves membership before reading the selected order. */
export class GetSalesOrderHandler extends ICQRSHandler<GetSalesOrderQuery, SalesOrderViewLookup> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly orders: OrdersReadService,
    ) {
        super(logger)
    }

    protected override process(query: GetSalesOrderQuery): Promise<SalesOrderViewLookup> {
        return this.orders.find(query.params.principal.id, query.params.request.workspaceId, query.params.request.id)
    }
}
