import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { WantConnectorCommand } from "../../application/want-connector.command"
import { WantConnectorInput } from "./dto/want-connector.input"
import { toWantConnectorRequest } from "./want-connector.mapper"

@Resolver()
/** GraphQL door of wantConnector. */
export class WantConnectorResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Records that the workspace wants a planned connector. */
    @Mutation(() => Boolean, { name: "wantConnector" })
    async wantConnector(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: WantConnectorInput,
    ): Promise<boolean> {
        await this.commandBus.execute(
            new WantConnectorCommand({ request: toWantConnectorRequest(workspaceId, input), principal }),
        )
        return true
    }
}
