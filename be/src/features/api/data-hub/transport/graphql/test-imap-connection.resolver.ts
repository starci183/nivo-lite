import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { TestImapConnectionQuery } from "../../application/test-imap-connection.query"
import { ImapFoldersType } from "./dto/imap-folders.type"
import { TestImapConnectionInput } from "./dto/test-imap-connection.input"
import { toImapFoldersType, toTestImapConnectionRequest } from "./test-imap-connection.mapper"

@Resolver()
/** GraphQL door of testImapConnection. */
export class TestImapConnectionResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Logs in to a mailbox read only and lists its folders; saves nothing. */
    @Query(() => ImapFoldersType, { name: "testImapConnection" })
    async testImapConnection(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: TestImapConnectionInput,
    ): Promise<ImapFoldersType> {
        const result = await this.queryBus.execute(
            new TestImapConnectionQuery({ request: toTestImapConnectionRequest(workspaceId, input), principal }),
        )
        return toImapFoldersType(result)
    }
}
