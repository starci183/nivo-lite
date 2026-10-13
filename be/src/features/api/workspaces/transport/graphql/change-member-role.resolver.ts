import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ChangeMemberRoleCommand } from "../../application/change-member-role.command"
import { ChangeMemberRoleInput } from "./dto/change-member-role.input"
import { toChangeMemberRoleRequest } from "./member-change.mapper"

@Resolver()
/** GraphQL door of changing a member's role. */
export class ChangeMemberRoleResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Changes a member's role: an owner grants any role, a manager only manager or staff. */
    @Mutation(() => Boolean, { name: "changeMemberRole" })
    async changeMemberRole(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: ChangeMemberRoleInput,
    ): Promise<boolean> {
        await this.commandBus.execute(
            new ChangeMemberRoleCommand({ request: toChangeMemberRoleRequest(workspaceId, input), principal }),
        )
        return true
    }
}
