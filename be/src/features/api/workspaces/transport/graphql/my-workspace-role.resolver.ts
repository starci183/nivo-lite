import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { MyWorkspaceRoleQuery } from "../../application/my-workspace-role.query"
import { toMyWorkspaceRoleRequest } from "./my-workspace-role.mapper"
import { PresentedRole } from "./dto/workspace-role.type"

@Resolver()
/** GraphQL door of the caller's role in the active workspace. */
export class MyWorkspaceRoleResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** The role the caller holds in the workspace named by X-Workspace-Id. */
    @Query(() => PresentedRole, { name: "myWorkspaceRole" })
    myWorkspaceRole(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<PresentedRole> {
        return this.queryBus.execute(
            new MyWorkspaceRoleQuery({ request: toMyWorkspaceRoleRequest(workspaceId), principal }),
        )
    }
}
