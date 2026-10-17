import { Module } from "@nestjs/common"
import { OrdersApiModule } from "../../orders.module"
import { GetSalesOrderResolver } from "./get-sales-order.resolver"
import { ListSalesOrdersResolver } from "./list-sales-orders.resolver"
import { ConfigurableModuleClass } from "./orders-graphql.module-definition"

@Module({
    imports: [OrdersApiModule.register({})],
    providers: [GetSalesOrderResolver, ListSalesOrdersResolver],
})
/** The GraphQL transport of the workspace sales orders application. */
export class OrdersGraphqlModule extends ConfigurableModuleClass {}
