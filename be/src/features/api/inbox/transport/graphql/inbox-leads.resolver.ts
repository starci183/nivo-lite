import type { CommandBus, QueryBus } from "@nestjs/cqrs"
import { Args, Mutation, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal, Public, PublicReason } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus, InjectQueryBus } from "@modules/platform/cqrs"
import { RateLimit, RateTier } from "@modules/platform/http-security"
import type { Principal } from "@modules/platform/cqrs"
import { AssignInboxLeadCommand } from "../../application/assign-inbox-lead.command"
import { GetInboxLeadQuery } from "../../application/get-inbox-lead.query"
import { GetWebsiteSiteQuery } from "../../application/get-website-site.query"
import { ListInboxLeadsQuery } from "../../application/list-inbox-leads.query"
import { SaveWebsiteSiteCommand } from "../../application/save-website-site.command"
import { SubmitWebsiteLeadCommand } from "../../application/submit-website-lead.command"
import { AssignInboxLeadInput } from "./dto/assign-inbox-lead.input"
import { InboxLeadDetailType } from "./dto/inbox-lead-detail.type"
import { InboxLeadInput } from "./dto/inbox-lead.input"
import { InboxLeadsInput } from "./dto/inbox-leads.input"
import { InboxLeadsType } from "./dto/inbox-leads.type"
import { SaveWebsiteSiteInput } from "./dto/save-website-site.input"
import { SubmitWebsiteLeadInput } from "./dto/submit-website-lead.input"
import { WebsiteSiteType } from "./dto/website-site.type"
import { toListInboxLeadsRequest, toSaveWebsiteSiteRequest, toSubmitWebsiteLeadRequest } from "./inbox-leads.mapper"

@Resolver()
/** GraphQL door for the lead-centric inbox: the customers, one customer opened, the hand-over and the website intake. */
export class InboxLeadsResolver {
    constructor(
        @InjectQueryBus() private readonly queryBus: QueryBus,
        @InjectCommandBus() private readonly commandBus: CommandBus,
    ) {}

    /** Lists the customers of a tab with the counts of every tab, the figures and the agents; any member. */
    @Query(() => InboxLeadsType, { name: "inboxLeads" })
    inboxLeads(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: InboxLeadsInput,
    ): Promise<InboxLeadsType> {
        return this.queryBus.execute(
            new ListInboxLeadsQuery({ request: toListInboxLeadsRequest(workspaceId, input), principal }),
        )
    }

    /** Opens one customer; any member. */
    @Query(() => InboxLeadDetailType, { name: "inboxLead" })
    inboxLead(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: InboxLeadInput,
    ): Promise<InboxLeadDetailType> {
        return this.queryBus.execute(new GetInboxLeadQuery({ request: { workspaceId, id: input.id }, principal }))
    }

    /** Hands one customer to an agent, or takes it back; owner or manager. */
    @Mutation(() => Boolean, { name: "assignInboxLead" })
    async assignInboxLead(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: AssignInboxLeadInput,
    ): Promise<boolean> {
        await this.commandBus.execute(
            new AssignInboxLeadCommand({
                request: { workspaceId, leadId: input.leadId, agentId: input.agentId },
                principal,
            }),
        )
        return true
    }

    /** Reads the website intake; the first read issues its key. */
    @Query(() => WebsiteSiteType, { name: "websiteSite" })
    websiteSite(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<WebsiteSiteType> {
        return this.queryBus.execute(new GetWebsiteSiteQuery({ request: { workspaceId }, principal }))
    }

    /** Changes the switches and the agent of the website intake; owner or manager. */
    @Mutation(() => WebsiteSiteType, { name: "saveWebsiteSite" })
    saveWebsiteSite(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SaveWebsiteSiteInput,
    ): Promise<WebsiteSiteType> {
        return this.commandBus.execute(
            new SaveWebsiteSiteCommand({ request: toSaveWebsiteSiteRequest(workspaceId, input), principal }),
        )
    }

    /** Takes the form of an anonymous visitor of the hosted page in as one input and one customer; rate limited, and refused unless the owner switched the intake on. */
    @Mutation(() => Boolean, { name: "submitWebsiteLead" })
    @Public({ reason: PublicReason.CatalogRead })
    @RateLimit(RateTier.Strict)
    async submitWebsiteLead(@Args("input") input: SubmitWebsiteLeadInput): Promise<boolean> {
        await this.commandBus.execute(new SubmitWebsiteLeadCommand({ request: toSubmitWebsiteLeadRequest(input) }))
        return true
    }
}
