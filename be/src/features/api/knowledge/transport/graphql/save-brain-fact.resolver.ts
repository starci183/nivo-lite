import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { SaveBrainFactCommand } from "../../application/save-brain-fact.command"
import { SaveBrainFactInput } from "./dto/save-brain-fact.input"
import { SavedFactType } from "./dto/saved-fact.type"
import { toSaveBrainFactRequest, toSaveBrainFactType } from "./save-brain-fact.mapper"

@Resolver()
/** GraphQL door of writes a fact, or a new value for an existing one; it is applied at once. */
export class SaveBrainFactResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Writes a fact, or a new value for an existing one; it is applied at once. */
    @Mutation(() => SavedFactType, { name: "saveBrainFact" })
    async saveBrainFact(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SaveBrainFactInput,
    ): Promise<SavedFactType> {
        const result = await this.commandBus.execute(
            new SaveBrainFactCommand({ request: toSaveBrainFactRequest(workspaceId, input), principal }),
        )
        return toSaveBrainFactType(result)
    }
}
