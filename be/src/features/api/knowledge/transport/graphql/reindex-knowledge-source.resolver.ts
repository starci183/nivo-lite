import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ReindexKnowledgeSourceCommand } from "../../application/reindex-knowledge-source.command"
import { ReindexKnowledgeSourceInput } from "./dto/reindex-knowledge-source.input"
import { SourceRefType } from "./dto/source-ref.type"
import { toReindexKnowledgeSourceRequest, toReindexKnowledgeSourceType } from "./reindex-knowledge-source.mapper"

@Resolver()
/** GraphQL door of reads a document again, optionally with new text. */
export class ReindexKnowledgeSourceResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Reads a document again, optionally with new text. */
    @Mutation(() => SourceRefType, { name: "reindexKnowledgeSource" })
    async reindexKnowledgeSource(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: ReindexKnowledgeSourceInput,
    ): Promise<SourceRefType> {
        const result = await this.commandBus.execute(
            new ReindexKnowledgeSourceCommand({
                request: toReindexKnowledgeSourceRequest(workspaceId, input),
                principal,
            }),
        )
        return toReindexKnowledgeSourceType(result)
    }
}
