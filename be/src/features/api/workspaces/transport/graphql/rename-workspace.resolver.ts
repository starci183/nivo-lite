import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus, type Principal } from "@modules/platform/cqrs"
import { RenameWorkspaceCommand } from "../../application/rename-workspace.command"
import { RenameWorkspaceInput } from "./dto/rename-workspace.input"

@Resolver()
/** GraphQL door of renaming a workspace. */
export class RenameWorkspaceResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Renames the workspace the request names; its owner or a manager only. */
    @Mutation(() => Boolean, { name: "renameWorkspace" })
    async renameWorkspace(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: RenameWorkspaceInput,
    ): Promise<boolean> {
        await this.commandBus.execute(
            new RenameWorkspaceCommand({ request: { workspaceId, name: input.name }, principal }),
        )
        return true
    }
}
