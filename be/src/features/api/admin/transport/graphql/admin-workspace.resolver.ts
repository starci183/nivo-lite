import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { GetWorkspaceDetailQuery } from "../../application/get-workspace-detail.query"
import { AdminWorkspaceInput } from "./dto/admin-workspace.input"
import { AdminWorkspaceDetailType } from "./dto/admin-workspace-detail.type"
import { toAdminWorkspaceRequest, toAdminWorkspaceDetailType } from "./admin-workspace.mapper"

@Resolver()
/** GraphQL door of adminWorkspace. */
export class AdminWorkspaceResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Answers the read-only overview of one workspace. */
    @Query(() => AdminWorkspaceDetailType, { name: "adminWorkspace" })
    async adminWorkspace(
        @CurrentPrincipal() principal: Principal,
        @Args("input") input: AdminWorkspaceInput,
    ): Promise<AdminWorkspaceDetailType> {
        const result = await this.queryBus.execute(
            new GetWorkspaceDetailQuery({ request: toAdminWorkspaceRequest(input), principal }),
        )
        return toAdminWorkspaceDetailType(result)
    }
}
