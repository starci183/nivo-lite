import { Controller, Get } from "@nestjs/common"
import type { QueryBus } from "@nestjs/cqrs"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { GetUsageSummaryQuery } from "../../application/get-usage-summary.query"
import { UsageSummaryResponse } from "./dto/usage-summary.response"
import { toUsageSummaryResponse } from "./usage.mapper"

@Controller("usage")
/** HTTP door of the AI usage of the requested workspace; the handler admits owner and manager only. */
export class UsageController {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** This month's AI usage by module and by day, with where it stands against the allowance. */
    @Get("summary")
    async summary(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<UsageSummaryResponse> {
        const result = await this.queryBus.execute(new GetUsageSummaryQuery({ request: { workspaceId }, principal }))
        return toUsageSummaryResponse(result)
    }
}
