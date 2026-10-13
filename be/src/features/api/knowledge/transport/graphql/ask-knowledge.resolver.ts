import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { AskKnowledgeQuery } from "../../application/ask-knowledge.query"
import { AskKnowledgeInput } from "./dto/ask-knowledge.input"
import { RetrievedPassageType } from "./dto/retrieved-passage.type"
import { toAskKnowledgeRequest, toAskKnowledgeType } from "./ask-knowledge.mapper"

@Resolver()
/** GraphQL door of tries a question against what an agent would retrieve. */
export class AskKnowledgeResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Tries a question against what an agent would retrieve. */
    @Query(() => [RetrievedPassageType], { name: "askKnowledge" })
    async askKnowledge(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: AskKnowledgeInput,
    ): Promise<Array<RetrievedPassageType>> {
        const result = await this.queryBus.execute(new AskKnowledgeQuery({ request: toAskKnowledgeRequest(workspaceId, input), principal }))
        return toAskKnowledgeType(result)
    }
}
