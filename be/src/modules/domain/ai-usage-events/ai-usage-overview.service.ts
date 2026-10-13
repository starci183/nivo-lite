import { Injectable } from "@nestjs/common"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { QuotaLookup, UsageSummary } from "./ai-usage-events.contracts"
import { AiUsageEventsService } from "./ai-usage-events.service"

@Injectable()
/** Member-scoped usage reads for the credits page and the manager's billing card. */
export class AiUsageOverviewService {
    constructor(
        private readonly usage: AiUsageEventsService,
        private readonly members: WorkspaceMembersService,
    ) {}

    /** Current-month quota for any active member; database failures surface to the browser. */
    async quotaStatus(userId: string, workspaceId: string): Promise<QuotaLookup> {
        await this.members.require(userId, workspaceId)
        return this.usage.readQuotaStatus(workspaceId)
    }

    /** The quota, module split and daily series for an active owner or manager. */
    async usageSummary(userId: string, workspaceId: string): Promise<UsageSummary> {
        await this.members.require(userId, workspaceId, ["owner", "manager"])
        return this.usage.usageSummary(workspaceId)
    }

    /** The non-guide model cost from a selected day for any active member. */
    async recentCostUsd(userId: string, workspaceId: string, from: string): Promise<number> {
        await this.members.require(userId, workspaceId)
        return this.usage.recentCostUsd(workspaceId, from)
    }
}
