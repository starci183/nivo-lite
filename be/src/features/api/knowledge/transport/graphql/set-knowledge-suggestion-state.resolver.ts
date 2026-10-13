import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { SetKnowledgeSuggestionStateCommand } from "../../application/set-knowledge-suggestion-state.command"
import { SetKnowledgeSuggestionStateInput } from "./dto/set-knowledge-suggestion-state.input"
import { toSetKnowledgeSuggestionStateRequest } from "./set-knowledge-suggestion-state.mapper"

@Resolver()
/** GraphQL door of marks a knowledge suggestion dismissed or not applicable, or brings it back. */
export class SetKnowledgeSuggestionStateResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Marks a knowledge suggestion dismissed or not applicable, or brings it back. */
    @Mutation(() => Boolean, { name: "setKnowledgeSuggestionState" })
    async setKnowledgeSuggestionState(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SetKnowledgeSuggestionStateInput,
    ): Promise<boolean> {
        await this.commandBus.execute(new SetKnowledgeSuggestionStateCommand({ request: toSetKnowledgeSuggestionStateRequest(workspaceId, input), principal }))
        return true
    }
}
