import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus, type Principal } from "@modules/platform/cqrs"
import { DeleteWorkspaceCommand } from "../../application/delete-workspace.command"
import { DeleteWorkspaceInput } from "./dto/delete-workspace.input"

@Resolver()
/** GraphQL door of deleting a workspace. */
export class DeleteWorkspaceResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Deletes the workspace the request names; its owner only, who types its name to confirm. */
    @Mutation(() => Boolean, { name: "deleteWorkspace" })
    async deleteWorkspace(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: DeleteWorkspaceInput,
    ): Promise<boolean> {
        await this.commandBus.execute(
            new DeleteWorkspaceCommand({ request: { workspaceId, confirmName: input.confirmName }, principal }),
        )
        return true
    }
}
