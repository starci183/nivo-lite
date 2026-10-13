import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { BillingWorkspaceQuery } from "../../application/billing-workspace.query"
import { BillingWorkspaceType } from "./dto/billing-workspace.type"
import { toBillingWorkspaceRequest, toBillingWorkspaceType } from "./billing-workspace.mapper"

@Resolver()
/** GraphQL door for billingWorkspace. */
export class BillingWorkspaceResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Reads billingWorkspace for the authenticated caller. */
    @Query(() => BillingWorkspaceType, { name: "billingWorkspace" })
    async billingWorkspace(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<BillingWorkspaceType> {
        const result = await this.queryBus.execute(
            new BillingWorkspaceQuery({ request: toBillingWorkspaceRequest(workspaceId), principal }),
        )
        return toBillingWorkspaceType(result)
    }
}
