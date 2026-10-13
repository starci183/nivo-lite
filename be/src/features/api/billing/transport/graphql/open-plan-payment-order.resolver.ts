import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { OpenPlanPaymentOrderQuery } from "../../application/open-plan-payment-order.query"
import { BillingPaymentOrderType } from "./dto/billing-payment-order.type"
import { toOpenPlanPaymentOrderRequest, toOpenPlanPaymentOrderType } from "./open-plan-payment-order.mapper"

@Resolver()
/** GraphQL door for openPlanPaymentOrder. */
export class OpenPlanPaymentOrderResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Reads openPlanPaymentOrder for the authenticated caller. */
    @Query(() => BillingPaymentOrderType, { name: "openPlanPaymentOrder", nullable: true })
    async openPlanPaymentOrder(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<BillingPaymentOrderType | null> {
        const result = await this.queryBus.execute(
            new OpenPlanPaymentOrderQuery({ request: toOpenPlanPaymentOrderRequest(workspaceId), principal }),
        )
        return toOpenPlanPaymentOrderType(result)
    }
}
