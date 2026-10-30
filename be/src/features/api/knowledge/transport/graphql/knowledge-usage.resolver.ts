import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { KnowledgeUsageQuery } from "../../application/knowledge-usage.query"
import { KnowledgeUsageType } from "./dto/knowledge-usage.type"
import { toKnowledgeUsageRequest, toKnowledgeUsageType } from "./knowledge-usage.mapper"

@Resolver()
/** GraphQL door of the raw document bytes the workspace has used. */
export class KnowledgeUsageResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** How much of its raw document allowance the workspace has used; any member may read it. */
    @Query(() => KnowledgeUsageType, { name: "knowledgeUsage" })
    async knowledgeUsage(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<KnowledgeUsageType> {
        const result = await this.queryBus.execute(
            new KnowledgeUsageQuery({ request: toKnowledgeUsageRequest(workspaceId), principal }),
        )
        return toKnowledgeUsageType(result)
    }
}
