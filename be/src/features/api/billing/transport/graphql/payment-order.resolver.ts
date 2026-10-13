import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { PaymentOrderQuery } from "../../application/payment-order.query"
import { BillingPaymentOrderType } from "./dto/billing-payment-order.type"
import { PaymentOrderInput } from "./dto/payment-order.input"
import { toPaymentOrderRequest, toPaymentOrderType } from "./payment-order.mapper"

@Resolver()
/** GraphQL door for paymentOrder. */
export class PaymentOrderResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Reads paymentOrder for the authenticated caller. */
    @Query(() => BillingPaymentOrderType, { name: "paymentOrder", nullable: true })
    async paymentOrder(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: PaymentOrderInput,
    ): Promise<BillingPaymentOrderType | null> {
        const result = await this.queryBus.execute(
            new PaymentOrderQuery({ request: toPaymentOrderRequest(workspaceId, input), principal }),
        )
        return toPaymentOrderType(result)
    }
}
