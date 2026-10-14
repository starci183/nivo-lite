import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ReconcileDetailsQuery } from "../../application/reconcile-details.query"
import { ReconcileDetailsArgs } from "./dto/reconcile-details.args"
import { ReconcileDetailsType } from "./dto/reconcile-details.type"
import { toReconcileDetailsRequest, toReconcileDetailsType } from "./reconcile-details.mapper"

@Resolver()
/** GraphQL door of one reconciliation's payment and candidate invoices. */
export class ReconcileDetailsResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** The payment and the candidate invoices, with customer, order and invoice status. */
    @Query(() => ReconcileDetailsType, { name: "reconcileDetails" })
    async getReconcileDetails(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args() args: ReconcileDetailsArgs,
    ): Promise<ReconcileDetailsType> {
        const result = await this.queryBus.execute(
            new ReconcileDetailsQuery({ request: toReconcileDetailsRequest(workspaceId, args), principal }),
        )
        return toReconcileDetailsType(result)
    }
}
