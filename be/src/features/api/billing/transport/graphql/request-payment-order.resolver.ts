import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { RequestPaymentOrderCommand } from "../../application/request-payment-order.command"
import { toRequestPaymentOrderRequest, toRequestPaymentOrderType } from "./request-payment-order.mapper"
import { RequestPaymentOrderInput } from "./dto/request-payment-order.input"
import { RequestPaymentOrderType } from "./dto/request-payment-order.type"

@Resolver()
/** GraphQL door for queued payment-order creation. */
export class RequestPaymentOrderResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Accepts the manager's request and enqueues the existing payment-order job. */
    @Mutation(() => RequestPaymentOrderType, { name: "requestPaymentOrder" })
    async requestPaymentOrder(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: RequestPaymentOrderInput,
    ): Promise<RequestPaymentOrderType> {
        const result = await this.commandBus.execute(
            new RequestPaymentOrderCommand({ request: toRequestPaymentOrderRequest(input, workspaceId), principal }),
        )
        return toRequestPaymentOrderType(result)
    }
}
