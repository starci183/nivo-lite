import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { RevokeApiKeyCommand } from "../../application/revoke-api-key.command"
import { toApiKeyType } from "./api-keys.mapper"
import { ApiKeyType } from "./dto/api-key.type"
import { RevokeApiKeyInput } from "./dto/revoke-api-key.input"

@Resolver()
/** GraphQL door of API key revocation. */
export class RevokeApiKeyResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Revokes a working key of the active workspace: it stops working at once. */
    @Mutation(() => ApiKeyType, { name: "revokeApiKey" })
    async revokeApiKey(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: RevokeApiKeyInput,
    ): Promise<ApiKeyType> {
        const result = await this.commandBus.execute(
            new RevokeApiKeyCommand({ request: { workspaceId, keyId: input.keyId }, principal }),
        )
        return toApiKeyType(result)
    }
}
