import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { CreateApiKeyCommand } from "../../application/create-api-key.command"
import { toCreatedApiKeyType } from "./api-keys.mapper"
import { CreateApiKeyInput } from "./dto/create-api-key.input"
import { CreatedApiKeyType } from "./dto/created-api-key.type"

@Resolver()
/** GraphQL door of API key creation. */
export class CreateApiKeyResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Creates a key for the active workspace; the secret is answered once. */
    @Mutation(() => CreatedApiKeyType, { name: "createApiKey" })
    async createApiKey(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: CreateApiKeyInput,
    ): Promise<CreatedApiKeyType> {
        const result = await this.commandBus.execute(
            new CreateApiKeyCommand({ request: { workspaceId, name: input.name }, principal }),
        )
        return toCreatedApiKeyType(result)
    }
}
