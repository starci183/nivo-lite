import type { CommandBus } from "@nestjs/cqrs"
import { Args, Int, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { SetMcpConnectorCredentialCommand } from "../../application/set-mcp-connector-credential.command"
import { SetMcpConnectorCredentialInput } from "./dto/set-mcp-connector-credential.input"
import { toCredentialInput } from "./mcp-gateway.mapper"

@Resolver()
/** GraphQL door of setMcpConnectorCredential. */
export class SetMcpConnectorCredentialResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Sets or rotates the sealed credential of a remote connector; answers the tool count read with it (0 when unreachable). */
    @Mutation(() => Int, { name: "setMcpConnectorCredential" })
    async setMcpConnectorCredential(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SetMcpConnectorCredentialInput,
    ): Promise<number> {
        const result = await this.commandBus.execute(
            new SetMcpConnectorCredentialCommand({
                request: { workspaceId, credential: toCredentialInput(input) },
                principal,
            }),
        )
        return result
    }
}
