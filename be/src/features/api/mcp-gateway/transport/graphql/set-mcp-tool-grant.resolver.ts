import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { SetMcpToolGrantCommand } from "../../application/set-mcp-tool-grant.command"
import { SetMcpToolGrantInput } from "./dto/set-mcp-tool-grant.input"
import { toGrantInput, toMcpDone } from "./mcp-gateway.mapper"

@Resolver()
/** GraphQL door of setMcpToolGrant. */
export class SetMcpToolGrantResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Sets one agent's grant of a gateway tool. */
    @Mutation(() => Boolean, { name: "setMcpToolGrant" })
    async setMcpToolGrant(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SetMcpToolGrantInput,
    ): Promise<boolean> {
        await this.commandBus.execute(
            new SetMcpToolGrantCommand({ request: { workspaceId, grant: toGrantInput(input) }, principal }),
        )
        return toMcpDone()
    }
}
