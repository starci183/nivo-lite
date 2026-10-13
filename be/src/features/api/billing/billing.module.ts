import { Module } from "@nestjs/common"
import { GetOpenOrderHandler } from "./application/get-open-order.handler"
import { GetOrderHandler } from "./application/get-order.handler"
import { OrderPlanHandler } from "./application/order-plan.handler"
import { RenewPlanHandler } from "./application/renew-plan.handler"

@Module({
    providers: [GetOpenOrderHandler, GetOrderHandler, OrderPlanHandler, RenewPlanHandler],
})
/** The billing feature: the handlers of its application. */
export class BillingApiModule {}
