import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { AcceptedLocale } from "@modules/platform/i18n"
import type { Locale } from "@modules/platform/i18n"
import { ApproveLeadGenCommentCommand } from "../../application/approve-leadgen-comment.command"
import { ApproveLeadGenCommentInput } from "./dto/approve-leadgen-comment.input"
import { LeadGenCommentStatusType } from "./dto/leadgen-comment-status.type"
import { toApproveLeadGenCommentRequest, toApprovedLeadGenCommentType } from "./approve-leadgen-comment.mapper"

@Resolver()
/** GraphQL door that queues a public-comment approval. */
export class ApproveLeadGenCommentResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Enqueues the existing decisions worker and immediately answers its polling identity. */
    @Mutation(() => LeadGenCommentStatusType, { name: "approveLeadGenComment" })
    async approveLeadGenComment(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @AcceptedLocale() locale: Locale,
        @Args("input") input: ApproveLeadGenCommentInput,
    ): Promise<LeadGenCommentStatusType> {
        const result = await this.commandBus.execute(
            new ApproveLeadGenCommentCommand({
                request: toApproveLeadGenCommentRequest(workspaceId, locale, input),
                principal,
            }),
        )
        return toApprovedLeadGenCommentType(result)
    }
}
