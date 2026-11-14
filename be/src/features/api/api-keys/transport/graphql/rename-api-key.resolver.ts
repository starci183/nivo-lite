import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus, type Principal } from "@modules/platform/cqrs"
import { RenameApiKeyCommand } from "../../application/rename-api-key.command"
import { toApiKeyType } from "./api-keys.mapper"
import { ApiKeyType } from "./dto/api-key.type"
import { RenameApiKeyInput } from "./dto/rename-api-key.input"

@Resolver()
/** GraphQL door of API key renaming. */
export class RenameApiKeyResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Renames a working key of the active workspace; owners and managers only. */
    @Mutation(() => ApiKeyType, { name: "renameApiKey" })
    async renameApiKey(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: RenameApiKeyInput,
    ): Promise<ApiKeyType> {
        const result = await this.commandBus.execute(
            new RenameApiKeyCommand({ request: { workspaceId, keyId: input.keyId, name: input.name }, principal }),
        )
        return toApiKeyType(result)
    }
}
