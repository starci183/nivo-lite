import type { CommandBus } from "@nestjs/cqrs"
import { Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus, type Principal } from "@modules/platform/cqrs"
import { RestoreWorkspaceCommand } from "../../application/restore-workspace.command"

@Resolver()
/** GraphQL door of restoring a deleted workspace. */
export class RestoreWorkspaceResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Restores the deleted workspace the request names, within 30 days of its deletion; its owner only. */
    @Mutation(() => Boolean, { name: "restoreWorkspace" })
    async restoreWorkspace(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<boolean> {
        await this.commandBus.execute(new RestoreWorkspaceCommand({ request: { workspaceId }, principal }))
        return true
    }
}
