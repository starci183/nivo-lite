import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { KnowledgeSourceQuery } from "../../application/knowledge-source.query"
import { KnowledgeSourceInput } from "./dto/knowledge-source.input"
import { KnowledgeSourceDetailType } from "./dto/knowledge-source-detail.type"
import { toKnowledgeSourceRequest, toKnowledgeSourceType } from "./knowledge-source.mapper"

@Resolver()
/** GraphQL door of reads one document of the workspace with its text and its passages. */
export class KnowledgeSourceResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Reads one document of the workspace with its text and its passages. */
    @Query(() => KnowledgeSourceDetailType, { name: "knowledgeSource" })
    async knowledgeSource(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: KnowledgeSourceInput,
    ): Promise<KnowledgeSourceDetailType> {
        const result = await this.queryBus.execute(
            new KnowledgeSourceQuery({ request: toKnowledgeSourceRequest(workspaceId, input), principal }),
        )
        return toKnowledgeSourceType(result)
    }
}
