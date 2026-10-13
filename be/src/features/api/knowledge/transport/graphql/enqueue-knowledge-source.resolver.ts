import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { EnqueueKnowledgeSourceCommand } from "../../application/enqueue-knowledge-source.command"
import { EnqueueKnowledgeSourceInput } from "./dto/enqueue-knowledge-source.input"
import { SourceRefType } from "./dto/source-ref.type"
import { toEnqueueKnowledgeSourceRequest, toEnqueueKnowledgeSourceType } from "./enqueue-knowledge-source.mapper"

@Resolver()
/** GraphQL door of adds a document and queues its indexing. */
export class EnqueueKnowledgeSourceResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Adds a document and queues its indexing. */
    @Mutation(() => SourceRefType, { name: "enqueueKnowledgeSource" })
    async enqueueKnowledgeSource(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: EnqueueKnowledgeSourceInput,
    ): Promise<SourceRefType> {
        const result = await this.commandBus.execute(new EnqueueKnowledgeSourceCommand({ request: toEnqueueKnowledgeSourceRequest(workspaceId, input), principal }))
        return toEnqueueKnowledgeSourceType(result)
    }
}
