import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { AcceptedLocale } from "@modules/platform/i18n"
import type { Locale } from "@modules/platform/i18n"
import { RequestGenerationCommand } from "../../application/request-generation.command"
import { AgentGenerationRequestedType } from "./dto/agent-generation-requested.type"
import { RequestAgentGenerationInput } from "./dto/request-agent-generation.input"
import { toAgentGenerationRequestedType, toRequestGenerationRequest } from "./agents.mapper"

@Resolver()
/** GraphQL door that queues a text on the agent engine. */
export class RequestAgentGenerationResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Queues a text on the agent engine and answers its id at once (or why it was refused); poll it with `agentGenerationStatus`. */
    @Mutation(() => AgentGenerationRequestedType, { name: "requestAgentGeneration" })
    async requestAgentGeneration(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @AcceptedLocale() locale: Locale,
        @Args("input") input: RequestAgentGenerationInput,
    ): Promise<AgentGenerationRequestedType> {
        const result = await this.commandBus.execute(
            new RequestGenerationCommand({
                request: toRequestGenerationRequest(workspaceId, input, locale),
                principal,
            }),
        )
        return toAgentGenerationRequestedType(result)
    }
}
