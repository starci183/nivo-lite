import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { BillingWorkspacesQuery } from "../../application/billing-workspaces.query"
import { BillingWorkspaceType } from "./dto/billing-workspace.type"
import { toBillingWorkspacesType } from "./billing-workspaces.mapper"

@Resolver()
/** GraphQL door for billingWorkspaces. */
export class BillingWorkspacesResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Reads billingWorkspaces for the authenticated caller. */
    @Query(() => [BillingWorkspaceType], { name: "billingWorkspaces" })
    async billingWorkspaces(@CurrentPrincipal() principal: Principal): Promise<ReadonlyArray<BillingWorkspaceType>> {
        const result = await this.queryBus.execute(new BillingWorkspacesQuery({ request: {}, principal }))
        return toBillingWorkspacesType(result)
    }
}
