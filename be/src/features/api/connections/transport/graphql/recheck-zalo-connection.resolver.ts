import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { RecheckZaloConnectionCommand } from "../../application/recheck-zalo-connection.command"
import { RecheckZaloConnectionInput } from "./dto/recheck-zalo-connection.input"
import { ZaloPageType } from "./dto/zalo-page.type"
import { toRecheckZaloConnectionRequest, toRecheckZaloConnectionType } from "./recheck-zalo-connection.mapper"

@Resolver()
/** GraphQL door of recheckZaloConnection. */
export class RecheckZaloConnectionResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Asks for the check of a Zalo OA connection, run again. */
    @Mutation(() => ZaloPageType, { name: "recheckZaloConnection" })
    async recheckZaloConnection(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: RecheckZaloConnectionInput,
    ): Promise<ZaloPageType> {
        const result = await this.commandBus.execute(
            new RecheckZaloConnectionCommand({
                request: toRecheckZaloConnectionRequest(workspaceId, input),
                principal,
            }),
        )
        return toRecheckZaloConnectionType(result)
    }
}
