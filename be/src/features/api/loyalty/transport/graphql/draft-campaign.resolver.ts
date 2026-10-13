import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { DraftCampaignCommand } from "../../application/draft-campaign.command"
import { toDraftCampaignRequest, toDraftCampaignType } from "./draft-campaign.mapper"
import { DraftCampaignInput } from "./dto/draft-campaign.input"
import { DraftCampaignType } from "./dto/draft-campaign.type"

@Resolver()
/** GraphQL door for a campaign's queued draft. */
export class DraftCampaignResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Requests one draft; the application verifies the caller's manager role. */
    @Mutation(() => DraftCampaignType, { name: "draftLoyaltyCampaign" })
    async draftLoyaltyCampaign(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: DraftCampaignInput,
    ): Promise<DraftCampaignType> {
        const result = await this.commandBus.execute(
            new DraftCampaignCommand({
                request: toDraftCampaignRequest(workspaceId, input),
                principal,
            }),
        )
        return toDraftCampaignType(result)
    }
}
