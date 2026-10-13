import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { KnowledgeSourcesQuery } from "../../application/knowledge-sources.query"
import { KnowledgeSourcesInput } from "./dto/knowledge-sources.input"
import { KnowledgeSourceType } from "./dto/knowledge-source.type"
import { toKnowledgeSourcesRequest, toKnowledgeSourcesType } from "./knowledge-sources.mapper"

@Resolver()
/** GraphQL door of lists the documents of the workspace, newest first and without their text. */
export class KnowledgeSourcesResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Lists the documents of the workspace, newest first and without their text. */
    @Query(() => [KnowledgeSourceType], { name: "knowledgeSources" })
    async knowledgeSources(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: KnowledgeSourcesInput,
    ): Promise<Array<KnowledgeSourceType>> {
        const result = await this.queryBus.execute(
            new KnowledgeSourcesQuery({ request: toKnowledgeSourcesRequest(workspaceId, input), principal }),
        )
        return toKnowledgeSourcesType(result)
    }
}
