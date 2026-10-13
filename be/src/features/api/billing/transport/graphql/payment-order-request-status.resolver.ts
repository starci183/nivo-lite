import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { PaymentOrderRequestStatusQuery } from "../../application/payment-order-request-status.query"
import {
    toPaymentOrderRequestStatusRequest,
    toPaymentOrderRequestStatusType,
} from "./payment-order-request-status.mapper"
import { PaymentOrderRequestStatusInput } from "./dto/payment-order-request-status.input"
import { PaymentOrderRequestStatusType } from "./dto/payment-order-request-status.type"

@Resolver()
/** GraphQL door for the caller's payment-order request progress. */
export class PaymentOrderRequestStatusResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Reads progress for the manager's own request in the selected workspace. */
    @Query(() => PaymentOrderRequestStatusType, { name: "paymentOrderRequestStatus", nullable: true })
    async paymentOrderRequestStatus(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: PaymentOrderRequestStatusInput,
    ): Promise<PaymentOrderRequestStatusType | null> {
        const result = await this.queryBus.execute(
            new PaymentOrderRequestStatusQuery({
                request: toPaymentOrderRequestStatusRequest(input, workspaceId),
                principal,
            }),
        )
        return toPaymentOrderRequestStatusType(result)
    }
}
