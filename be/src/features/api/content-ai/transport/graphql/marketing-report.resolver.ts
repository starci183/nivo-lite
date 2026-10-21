import type { CommandBus, QueryBus } from "@nestjs/cqrs"
import { Args, Mutation, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus, InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { AcceptedLocale } from "@modules/platform/i18n"
import type { Locale } from "@modules/platform/i18n"
import { GetMarketingReportQuery } from "../../application/get-marketing-report.query"
import { PostMarketingReportCommand } from "../../application/post-marketing-report.command"
import { MarketingReportInput } from "./dto/marketing-report.input"
import { WeeklyReportType } from "./dto/marketing-report.type"

@Resolver()
/** GraphQL doors of the AI Marketing performance: the weekly report and posting it into the Marketing room. */
export class MarketingReportResolver {
    constructor(
        @InjectCommandBus() private readonly commandBus: CommandBus,
        @InjectQueryBus() private readonly queryBus: QueryBus,
    ) {}

    /** The weekly report the "Performance" tab shows. */
    @Query(() => WeeklyReportType, { name: "marketingWeeklyReport" })
    async marketingWeeklyReport(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: MarketingReportInput,
        @AcceptedLocale() locale: Locale,
    ): Promise<WeeklyReportType> {
        return this.queryBus.execute(
            new GetMarketingReportQuery({ request: { workspaceId, weekStart: input.weekStart, locale }, principal }),
        )
    }

    /** Syncs the Meta insights and posts the last week's report as a card in the Marketing room. */
    @Mutation(() => WeeklyReportType, { name: "postMarketingWeeklyReport" })
    async postMarketingWeeklyReport(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @AcceptedLocale() locale: Locale,
    ): Promise<WeeklyReportType> {
        return this.commandBus.execute(new PostMarketingReportCommand({ request: { workspaceId, locale }, principal }))
    }
}
