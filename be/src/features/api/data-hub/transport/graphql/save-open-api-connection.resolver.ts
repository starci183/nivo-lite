import type { CommandBus } from "@nestjs/cqrs"
import { Args, ID, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { SaveOpenApiConnectionCommand } from "../../application/save-open-api-connection.command"
import { SaveOpenApiConnectionInput } from "./dto/save-open-api-connection.input"
import { toSaveOpenApiConnectionRequest } from "./save-open-api-connection.mapper"

@Resolver()
/** GraphQL door of saveOpenApiConnection. */
export class SaveOpenApiConnectionResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Creates or updates an API connection; answers its id. */
    @Mutation(() => ID, { name: "saveOpenApiConnection" })
    saveOpenApiConnection(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SaveOpenApiConnectionInput,
    ): Promise<string> {
        return this.commandBus.execute(
            new SaveOpenApiConnectionCommand({
                request: toSaveOpenApiConnectionRequest(workspaceId, input),
                principal,
            }),
        )
    }
}
