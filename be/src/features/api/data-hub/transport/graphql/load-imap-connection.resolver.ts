import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { LoadImapConnectionQuery } from "../../application/load-imap-connection.query"
import { ImapConnectionType } from "./dto/imap-connection.type"
import { LoadImapConnectionInput } from "./dto/load-imap-connection.input"
import { toImapConnectionType, toLoadImapConnectionRequest } from "./load-imap-connection.mapper"

@Resolver()
/** GraphQL door of loadImapConnection. */
export class LoadImapConnectionResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Reads a saved mailbox connection for editing, without its password. */
    @Query(() => ImapConnectionType, { name: "loadImapConnection" })
    async loadImapConnection(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: LoadImapConnectionInput,
    ): Promise<ImapConnectionType> {
        const result = await this.queryBus.execute(
            new LoadImapConnectionQuery({ request: toLoadImapConnectionRequest(workspaceId, input), principal }),
        )
        return toImapConnectionType(result)
    }
}
