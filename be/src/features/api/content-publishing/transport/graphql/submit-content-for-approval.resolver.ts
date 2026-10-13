import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { AcceptedLocale } from "@modules/platform/i18n"
import type { Locale } from "@modules/platform/i18n"
import { SubmitContentForApprovalCommand } from "../../application/submit-content-for-approval.command"
import { SubmitContentForApprovalInput } from "./dto/submit-content-for-approval.input"
import { SubmitContentForApprovalType } from "./dto/submit-content-for-approval.type"
import { toSubmitContentForApprovalRequest, toSubmitContentForApprovalType } from "./submit-content-for-approval.mapper"

@Resolver()
/** GraphQL door of draft submission to the human decision queue. */
export class SubmitContentForApprovalResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Submits a complete draft; it cannot approve or post it. */
    @Mutation(() => SubmitContentForApprovalType, { name: "submitContentForApproval" })
    async submitContentForApproval(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @AcceptedLocale() locale: Locale,
        @Args("input") input: SubmitContentForApprovalInput,
    ): Promise<SubmitContentForApprovalType> {
        const result = await this.commandBus.execute(
            new SubmitContentForApprovalCommand({
                request: toSubmitContentForApprovalRequest(workspaceId, locale, input),
                principal,
            }),
        )
        return toSubmitContentForApprovalType(result)
    }
}
