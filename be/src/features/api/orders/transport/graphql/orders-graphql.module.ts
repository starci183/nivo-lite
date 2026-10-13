import { Module } from "@nestjs/common"
import { OrdersApiModule } from "../../orders.module"
import { GetSalesOrderResolver } from "./get-sales-order.resolver"
import { ListSalesOrdersResolver } from "./list-sales-orders.resolver"

@Module({
    imports: [OrdersApiModule],
    providers: [GetSalesOrderResolver, ListSalesOrdersResolver],
})
/** The GraphQL transport of the workspace sales orders application. */
export class OrdersGraphqlModule {}
