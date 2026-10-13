import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { BillingReviewTransactionsQuery } from "../../application/billing-review-transactions.query"
import { BillingReviewTransactionType } from "./dto/billing-review-transaction.type"
import { BillingReviewTransactionsInput } from "./dto/billing-review-transactions.input"
import {
    toBillingReviewTransactionsRequest,
    toBillingReviewTransactionsType,
} from "./billing-review-transactions.mapper"

@Resolver()
/** GraphQL door for billingReviewTransactions. */
export class BillingReviewTransactionsResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Reads billingReviewTransactions for the authenticated caller. */
    @Query(() => [BillingReviewTransactionType], { name: "billingReviewTransactions" })
    async billingReviewTransactions(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: BillingReviewTransactionsInput,
    ): Promise<ReadonlyArray<BillingReviewTransactionType>> {
        const result = await this.queryBus.execute(
            new BillingReviewTransactionsQuery({
                request: toBillingReviewTransactionsRequest(workspaceId, input),
                principal,
            }),
        )
        return toBillingReviewTransactionsType(result)
    }
}
