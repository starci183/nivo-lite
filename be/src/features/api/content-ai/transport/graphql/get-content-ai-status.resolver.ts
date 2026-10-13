import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { GetContentAiStatusQuery } from "../../application/get-content-ai-status.query"
import { toGetContentAiStatusRequest, toGetContentAiStatusType } from "./get-content-ai-status.mapper"
import { GetContentAiStatusInput } from "./dto/get-content-ai-status.input"
import { ContentAiStatusType } from "./dto/content-ai-status.type"

@Resolver()
/** The read-only status door for workbench polling. */
export class GetContentAiStatusResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Answers progress and the applied result for this workspace. */
    @Query(() => ContentAiStatusType, { name: "contentAiStatus" })
    async contentAiStatus(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: GetContentAiStatusInput,
    ): Promise<ContentAiStatusType> {
        const result = await this.queryBus.execute(
            new GetContentAiStatusQuery({ request: toGetContentAiStatusRequest(workspaceId, input), principal }),
        )
        return toGetContentAiStatusType(result)
    }
}
