import type { CommandBus, QueryBus } from "@nestjs/cqrs"
import { Args, Mutation, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal, Public, PublicReason } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus, InjectQueryBus, type Principal } from "@modules/platform/cqrs"
import { RateLimit, RateTier } from "@modules/platform/http-security"
import { GetWebsiteThemeQuery } from "../../application/get-website-theme.query"
import { GetWebsiteSiteQuery } from "../../application/get-website-site.query"
import { SaveWebsiteSiteCommand } from "../../application/save-website-site.command"
import { SubmitWebsiteLeadCommand } from "../../application/submit-website-lead.command"
import { SaveWebsiteSiteInput } from "./dto/save-website-site.input"
import { SubmitWebsiteLeadInput } from "./dto/submit-website-lead.input"
import { WebsiteSiteType } from "./dto/website-site.type"
import { WebsiteThemeInput } from "./dto/website-theme.input"
import { WebsiteThemeType } from "./dto/website-theme.type"
import { toSaveWebsiteSiteRequest, toSubmitWebsiteLeadRequest } from "./website-intake.mapper"

@Resolver()
/** GraphQL door for the website intake: the owner's settings and the form an anonymous visitor submits. */
export class WebsiteIntakeResolver {
    constructor(
        @InjectQueryBus() private readonly queryBus: QueryBus,
        @InjectCommandBus() private readonly commandBus: CommandBus,
    ) {}

    /** Reads the website intake; the first read issues its key. */
    @Query(() => WebsiteSiteType, { name: "websiteSite" })
    websiteSite(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<WebsiteSiteType> {
        return this.queryBus.execute(new GetWebsiteSiteQuery({ request: { workspaceId }, principal }))
    }

    /** The brand theme parameters of the workspace behind a site key, for the hosted page of its website: anonymous, rate limited, parameters only; null while the NIVO default stands. */
    @Query(() => WebsiteThemeType, { name: "websiteTheme", nullable: true })
    @Public({ reason: PublicReason.CatalogRead })
    @RateLimit(RateTier.Strict)
    websiteTheme(@Args("input") input: WebsiteThemeInput): Promise<WebsiteThemeType | null> {
        return this.queryBus.execute(new GetWebsiteThemeQuery({ request: { siteKey: input.siteKey } }))
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

    /** Takes the form of an anonymous visitor of the hosted page in: one stored input, the core contact met, the owning agent woken; rate limited, and refused unless the owner switched the intake on. */
    @Mutation(() => Boolean, { name: "submitWebsiteLead" })
    @Public({ reason: PublicReason.CatalogRead })
    @RateLimit(RateTier.Strict)
    async submitWebsiteLead(@Args("input") input: SubmitWebsiteLeadInput): Promise<boolean> {
        await this.commandBus.execute(new SubmitWebsiteLeadCommand({ request: toSubmitWebsiteLeadRequest(input) }))
        return true
    }
}
