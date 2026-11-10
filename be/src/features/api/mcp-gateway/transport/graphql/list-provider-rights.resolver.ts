import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ListProviderRightsQuery } from "../../application/list-provider-rights.query"
import { ProviderRightsType } from "./dto/provider-rights.type"
import { toProviderRightsType } from "./provider-rights.mapper"

@Resolver()
/** GraphQL door of providerRights. */
export class ListProviderRightsResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Every provider with its abilities and whether it is connected, and every attachment of the workspace. */
    @Query(() => ProviderRightsType, { name: "providerRights" })
    async providerRights(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<ProviderRightsType> {
        const result = await this.queryBus.execute(new ListProviderRightsQuery({ request: { workspaceId }, principal }))
        return toProviderRightsType(result)
    }
}
