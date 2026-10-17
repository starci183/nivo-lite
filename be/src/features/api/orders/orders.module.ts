import { Module } from "@nestjs/common"
import { GetSalesOrderHandler } from "./application/get-sales-order.handler"
import { ListSalesOrdersHandler } from "./application/list-sales-orders.handler"
import { ConfigurableModuleClass } from "./orders.module-definition"

@Module({ providers: [GetSalesOrderHandler, ListSalesOrdersHandler] })
/** The workspace sales order read application. */
export class OrdersApiModule extends ConfigurableModuleClass {}
