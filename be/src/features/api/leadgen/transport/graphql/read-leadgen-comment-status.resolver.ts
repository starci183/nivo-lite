import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ReadLeadGenCommentStatusQuery } from "../../application/read-leadgen-comment-status.query"
import { ReadLeadGenCommentStatusInput } from "./dto/read-leadgen-comment-status.input"
import { LeadGenCommentStatusType } from "./dto/leadgen-comment-status.type"
import { toLeadGenCommentStatusType, toReadLeadGenCommentStatusRequest } from "./read-leadgen-comment-status.mapper"

@Resolver()
/** GraphQL progress door of a Lead Gen public-comment approval. */
export class ReadLeadGenCommentStatusResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Reads the job's queued, running or terminal state until the public reply finishes. */
    @Query(() => LeadGenCommentStatusType, { name: "leadGenCommentStatus" })
    async leadGenCommentStatus(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: ReadLeadGenCommentStatusInput,
    ): Promise<LeadGenCommentStatusType> {
        const result = await this.queryBus.execute(
            new ReadLeadGenCommentStatusQuery({
                request: toReadLeadGenCommentStatusRequest(workspaceId, input),
                principal,
            }),
        )
        return toLeadGenCommentStatusType(result)
    }
}
