import type { CommandBus } from "@nestjs/cqrs"
import { Args, ID, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { SaveImapConnectionCommand } from "../../application/save-imap-connection.command"
import { SaveImapConnectionInput } from "./dto/save-imap-connection.input"
import { toSaveImapConnectionRequest } from "./save-imap-connection.mapper"

@Resolver()
/** GraphQL door of saveImapConnection. */
export class SaveImapConnectionResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Creates a mailbox connection or updates an existing one; answers its id. */
    @Mutation(() => ID, { name: "saveImapConnection" })
    saveImapConnection(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SaveImapConnectionInput,
    ): Promise<string> {
        return this.commandBus.execute(
            new SaveImapConnectionCommand({ request: toSaveImapConnectionRequest(workspaceId, input), principal }),
        )
    }
}
