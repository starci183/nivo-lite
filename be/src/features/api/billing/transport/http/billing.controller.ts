import { Body, Controller, Get, Param, Post } from "@nestjs/common"
import type { CommandBus, QueryBus } from "@nestjs/cqrs"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus, InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { GetOpenOrderQuery } from "../../application/get-open-order.query"
import { GetOrderQuery } from "../../application/get-order.query"
import { OrderPlanCommand } from "../../application/order-plan.command"
import { RenewPlanCommand } from "../../application/renew-plan.command"
import { toPayableOrderResponse } from "./billing.mapper"
import { OrderIdRequest } from "./dto/order-id.request"
import { OrderPlanRequest } from "./dto/order-plan.request"
import { PayableOrderResponse } from "./dto/payable-order.response"

@Controller("billing")
/** HTTP doors of the payments of the requested workspace; the service admits the roles. */
export class BillingController {
    constructor(
        @InjectQueryBus() private readonly queryBus: QueryBus,
        @InjectCommandBus() private readonly commandBus: CommandBus,
    ) {}

    /** The newest plan payment that can still be paid, or an empty answer when there is none. */
    @Get("orders/open")
    async open(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<PayableOrderResponse | null> {
        const result = await this.queryBus.execute(new GetOpenOrderQuery({ request: { workspaceId }, principal }))
        return result
    }

    /** One payment order of the workspace with the QR that pays it. */
    @Get("orders/:orderId")
    async order(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Param() params: OrderIdRequest,
    ): Promise<PayableOrderResponse> {
        const result = await this.queryBus.execute(
            new GetOrderQuery({ request: { workspaceId, orderId: params.orderId }, principal }),
        )
        return toPayableOrderResponse(result)
    }

    /** The first payment of the workspace for the plan it chose (owner or manager). */
    @Post("orders")
    async orderPlan(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Body() input: OrderPlanRequest,
    ): Promise<PayableOrderResponse> {
        const result = await this.commandBus.execute(
            new OrderPlanCommand({ request: { workspaceId, planCode: input.planCode }, principal }),
        )
        return toPayableOrderResponse(result)
    }

    /** A payment order that renews the current plan (owner or manager). */
    @Post("renewals")
    async renew(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<PayableOrderResponse> {
        const result = await this.commandBus.execute(new RenewPlanCommand({ request: { workspaceId }, principal }))
        return toPayableOrderResponse(result)
    }
}
