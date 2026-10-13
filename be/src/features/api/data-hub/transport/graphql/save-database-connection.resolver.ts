import type { CommandBus } from "@nestjs/cqrs"
import { Args, ID, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { SaveDatabaseConnectionCommand } from "../../application/save-database-connection.command"
import { SaveDatabaseConnectionInput } from "./dto/save-database-connection.input"
import { toSaveDatabaseConnectionRequest } from "./save-database-connection.mapper"

@Resolver()
/** GraphQL door of saveDatabaseConnection. */
export class SaveDatabaseConnectionResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Creates or updates a database connection; answers its id. */
    @Mutation(() => ID, { name: "saveDatabaseConnection" })
    saveDatabaseConnection(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SaveDatabaseConnectionInput,
    ): Promise<string> {
        return this.commandBus.execute(
            new SaveDatabaseConnectionCommand({
                request: toSaveDatabaseConnectionRequest(workspaceId, input),
                principal,
            }),
        )
    }
}
