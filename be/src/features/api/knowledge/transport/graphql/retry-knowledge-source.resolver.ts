import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { RetryKnowledgeSourceCommand } from "../../application/retry-knowledge-source.command"
import { RetryKnowledgeSourceInput } from "./dto/retry-knowledge-source.input"
import { SourceRefType } from "./dto/source-ref.type"
import { toRetryKnowledgeSourceRequest, toRetryKnowledgeSourceType } from "./retry-knowledge-source.mapper"

@Resolver()
/** GraphQL door of puts a failed or credit-blocked document back on the queue. */
export class RetryKnowledgeSourceResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Puts a failed or credit-blocked document back on the queue. */
    @Mutation(() => SourceRefType, { name: "retryKnowledgeSource" })
    async requeueKnowledgeSource(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: RetryKnowledgeSourceInput,
    ): Promise<SourceRefType> {
        const result = await this.commandBus.execute(
            new RetryKnowledgeSourceCommand({ request: toRetryKnowledgeSourceRequest(workspaceId, input), principal }),
        )
        return toRetryKnowledgeSourceType(result)
    }
}
