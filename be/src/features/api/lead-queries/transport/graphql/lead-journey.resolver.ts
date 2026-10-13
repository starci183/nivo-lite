import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { LeadJourneyQuery } from "../../application/lead-journey.query"
import { LeadJourneyInput } from "./dto/lead-journey.input"
import { LeadJourneyType } from "./dto/lead-journey.type"
import { toLeadJourneyRequest, toLeadJourneyType } from "./lead-journey.mapper"

@Resolver()
/** The GraphQL door of a lead's journey. */
export class LeadJourneyResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Reads a workspace's lead with steps, drafts, evidence and available owners. */
    @Query(() => LeadJourneyType, { name: "leadJourney" })
    async leadJourney(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: LeadJourneyInput,
    ): Promise<LeadJourneyType> {
        const result = await this.queryBus.execute(
            new LeadJourneyQuery({ request: toLeadJourneyRequest(workspaceId, input), principal }),
        )
        return toLeadJourneyType(result)
    }
}
