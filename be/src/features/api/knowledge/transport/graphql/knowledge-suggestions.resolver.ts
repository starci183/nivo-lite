import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { KnowledgeSuggestionsQuery } from "../../application/knowledge-suggestions.query"
import { KnowledgeSuggestionContextType } from "./dto/knowledge-suggestion-context.type"
import { toKnowledgeSuggestionsRequest, toKnowledgeSuggestionsType } from "./knowledge-suggestions.mapper"

@Resolver()
/** GraphQL door of reads what the workspace decided about its knowledge suggestions and its business type. */
export class KnowledgeSuggestionsResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Reads what the workspace decided about its knowledge suggestions and its business type. */
    @Query(() => KnowledgeSuggestionContextType, { name: "knowledgeSuggestions" })
    async knowledgeSuggestions(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<KnowledgeSuggestionContextType> {
        const result = await this.queryBus.execute(new KnowledgeSuggestionsQuery({ request: toKnowledgeSuggestionsRequest(workspaceId), principal }))
        return toKnowledgeSuggestionsType(result)
    }
}
