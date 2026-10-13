import { Body, Controller, Get, Post } from "@nestjs/common"
import type { CommandBus, QueryBus } from "@nestjs/cqrs"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus, InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { BuyCreditPackCommand } from "../../application/buy-credit-pack.command"
import { GetCreditsOverviewQuery } from "../../application/get-credits-overview.query"
import { UpgradePlanCommand } from "../../application/upgrade-plan.command"
import { toCreditOrderResponse, toCreditsOverviewResponse, toUpgradeOrderResponse } from "./credits.mapper"
import { CreditOrderResponse } from "./dto/credit-order.response"
import { BuyCreditPackRequest } from "./dto/buy-credit-pack.request"
import { CreditsOverviewResponse } from "./dto/credits-overview.response"
import { UpgradeOrderResponse } from "./dto/upgrade-order.response"
import { UpgradePlanRequest } from "./dto/upgrade-plan.request"

@Controller("credits")
/** HTTP doors of the credits of the requested workspace; the service admits the roles. */
export class CreditsController {
    constructor(
        @InjectQueryBus() private readonly queryBus: QueryBus,
        @InjectCommandBus() private readonly commandBus: CommandBus,
    ) {}

    /** Everything the credits page shows; any member may read it. */
    @Get("overview")
    async overview(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<CreditsOverviewResponse> {
        const result = await this.queryBus.execute(new GetCreditsOverviewQuery({ request: { workspaceId }, principal }))
        return toCreditsOverviewResponse(result)
    }

    /** A pending top-up order for one pack (owner or manager). */
    @Post("topups")
    async topup(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Body() input: BuyCreditPackRequest,
    ): Promise<CreditOrderResponse> {
        const result = await this.commandBus.execute(
            new BuyCreditPackCommand({ request: { workspaceId, packCode: input.packCode }, principal }),
        )
        return toCreditOrderResponse(result)
    }

    /** A pending upgrade order for the prorated difference (owner or manager). */
    @Post("upgrades")
    async upgrade(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Body() input: UpgradePlanRequest,
    ): Promise<UpgradeOrderResponse> {
        const result = await this.commandBus.execute(
            new UpgradePlanCommand({ request: { workspaceId, planCode: input.planCode }, principal }),
        )
        return toUpgradeOrderResponse(result)
    }
}
