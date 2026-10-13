import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { AcceptedLocale } from "@modules/platform/i18n"
import type { Locale } from "@modules/platform/i18n"
import { SubmitLoyaltyCampaignCommand } from "../../application/submit-loyalty-campaign.command"
import { LoyaltyCampaignInput } from "./dto/loyalty-campaign.input"
import { SubmitLoyaltyCampaignType } from "./dto/submit-loyalty-campaign.type"
import { toSubmitLoyaltyCampaignRequest, toSubmitLoyaltyCampaignType } from "./submit-loyalty-campaign.mapper"

@Resolver()
/** GraphQL door that sends a finished loyalty draft through the approval flow. */
export class SubmitLoyaltyCampaignResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Sends a finished draft into the work-item approval flow and keeps that work item on the campaign. */
    @Mutation(() => SubmitLoyaltyCampaignType, { name: "submitLoyaltyCampaign" })
    async submitLoyaltyCampaign(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @AcceptedLocale() locale: Locale,
        @Args("input") input: LoyaltyCampaignInput,
    ): Promise<SubmitLoyaltyCampaignType> {
        const result = await this.commandBus.execute(
            new SubmitLoyaltyCampaignCommand({
                request: toSubmitLoyaltyCampaignRequest(workspaceId, locale, input),
                principal,
            }),
        )
        return toSubmitLoyaltyCampaignType(result)
    }
}
