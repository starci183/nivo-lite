import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ListWorkspacesQuery } from "../../application/list-workspaces.query"
import { AdminWorkspacesInput } from "./dto/admin-workspaces.input"
import { AdminWorkspaceListType } from "./dto/admin-workspace-list.type"
import { toAdminWorkspacesRequest, toAdminWorkspaceListType } from "./admin-workspaces.mapper"

@Resolver()
/** GraphQL door of adminWorkspaces. */
export class AdminWorkspacesResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Lists every customer workspace with billing, agents, connections and activity, filtered and searched. */
    @Query(() => AdminWorkspaceListType, { name: "adminWorkspaces" })
    async adminWorkspaces(
        @CurrentPrincipal() principal: Principal,
        @Args("input") input: AdminWorkspacesInput,
    ): Promise<AdminWorkspaceListType> {
        const result = await this.queryBus.execute(
            new ListWorkspacesQuery({ request: toAdminWorkspacesRequest(input), principal }),
        )
        return toAdminWorkspaceListType(result)
    }
}
