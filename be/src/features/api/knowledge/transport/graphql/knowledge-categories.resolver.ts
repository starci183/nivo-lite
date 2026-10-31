import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { KnowledgeCategoriesQuery } from "../../application/knowledge-categories.query"
import { KnowledgeCategoryType } from "./dto/knowledge-category.type"
import { toKnowledgeCategoriesRequest, toKnowledgeCategoryTypes } from "./knowledge-categories.mapper"

@Resolver()
/** GraphQL door of what each category of the documents of the workspace holds. */
export class KnowledgeCategoriesResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** The categories (topics) of the documents with their document count and raw bytes; any member may read them. */
    @Query(() => [KnowledgeCategoryType], { name: "knowledgeCategories" })
    async knowledgeCategories(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<Array<KnowledgeCategoryType>> {
        const result = await this.queryBus.execute(
            new KnowledgeCategoriesQuery({ request: toKnowledgeCategoriesRequest(workspaceId), principal }),
        )
        return toKnowledgeCategoryTypes(result)
    }
}
