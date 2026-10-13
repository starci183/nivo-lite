import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { StartZaloConnectionCommand } from "../../application/start-zalo-connection.command"
import { StartZaloConnectionInput } from "./dto/start-zalo-connection.input"
import { ZaloWizardConnectionType } from "./dto/zalo-wizard-connection.type"
import { toStartZaloConnectionRequest, toStartZaloConnectionType } from "./start-zalo-connection.mapper"

@Resolver()
/** GraphQL door of startZaloConnection. */
export class StartZaloConnectionResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Starts a Zalo OA connection from the app keys. */
    @Mutation(() => ZaloWizardConnectionType, { name: "startZaloConnection" })
    async startZaloConnection(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: StartZaloConnectionInput,
    ): Promise<ZaloWizardConnectionType> {
        const result = await this.commandBus.execute(
            new StartZaloConnectionCommand({ request: toStartZaloConnectionRequest(workspaceId, input), principal }),
        )
        return toStartZaloConnectionType(result)
    }
}
