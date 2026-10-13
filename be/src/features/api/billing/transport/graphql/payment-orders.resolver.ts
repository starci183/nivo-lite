import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { PaymentOrdersQuery } from "../../application/payment-orders.query"
import { BillingPaymentOrderType } from "./dto/billing-payment-order.type"
import { toPaymentOrdersRequest, toPaymentOrdersType } from "./payment-orders.mapper"

@Resolver()
/** GraphQL door for paymentOrders. */
export class PaymentOrdersResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Reads paymentOrders for the authenticated caller. */
    @Query(() => [BillingPaymentOrderType], { name: "paymentOrders" })
    async paymentOrders(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<ReadonlyArray<BillingPaymentOrderType>> {
        const result = await this.queryBus.execute(
            new PaymentOrdersQuery({ request: toPaymentOrdersRequest(workspaceId), principal }),
        )
        return toPaymentOrdersType(result)
    }
}
