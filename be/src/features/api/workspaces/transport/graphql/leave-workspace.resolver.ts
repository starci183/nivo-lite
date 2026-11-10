import type { CommandBus } from "@nestjs/cqrs"
import { Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { LeaveWorkspaceCommand } from "../../application/leave-workspace.command"

@Resolver()
/** GraphQL door of leaving a workspace. */
export class LeaveWorkspaceResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Takes the caller out of the workspace the request names; the last active owner is refused. */
    @Mutation(() => Boolean, { name: "leaveWorkspace" })
    async leaveWorkspace(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<boolean> {
        await this.commandBus.execute(new LeaveWorkspaceCommand({ request: { workspaceId }, principal }))
        return true
    }
}
