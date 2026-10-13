import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { DeleteConnectionCommand } from "../../application/delete-connection.command"
import { DeleteConnectionInput } from "./dto/delete-connection.input"
import { toDeleteConnectionRequest } from "./delete-connection.mapper"

@Resolver()
/** GraphQL door of deleteConnection. */
export class DeleteConnectionResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Removes a disconnected connection from the list. */
    @Mutation(() => Boolean, { name: "deleteConnection" })
    async deleteConnection(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: DeleteConnectionInput,
    ): Promise<boolean> {
        await this.commandBus.execute(
            new DeleteConnectionCommand({ request: toDeleteConnectionRequest(workspaceId, input), principal }),
        )
        return true
    }
}
