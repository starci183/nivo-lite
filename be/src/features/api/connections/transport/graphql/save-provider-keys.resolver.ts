import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { SaveProviderKeysCommand } from "../../application/save-provider-keys.command"
import { SaveProviderKeysInput } from "./dto/save-provider-keys.input"
import { ProviderKeysResultType } from "./dto/provider-keys-result.type"
import { toSaveProviderKeysRequest, toSaveProviderKeysType } from "./save-provider-keys.mapper"

@Resolver()
/** GraphQL door of saveProviderKeys. */
export class SaveProviderKeysResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Stores the keys the owner copied from payOS or Casso. */
    @Mutation(() => ProviderKeysResultType, { name: "saveProviderKeys" })
    async saveProviderKeys(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SaveProviderKeysInput,
    ): Promise<ProviderKeysResultType> {
        const result = await this.commandBus.execute(
            new SaveProviderKeysCommand({ request: toSaveProviderKeysRequest(workspaceId, input), principal }),
        )
        return toSaveProviderKeysType(result)
    }
}
