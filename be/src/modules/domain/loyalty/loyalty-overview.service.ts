import { Injectable } from "@nestjs/common"
import { LoyaltyCampaignsService } from "@modules/domain/loyalty-campaigns"
import { LoyaltyLedgerService } from "@modules/domain/loyalty-ledger"
import { LoyaltyProgramsService } from "@modules/domain/loyalty-programs"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import type { LoyaltyOverview, WorkspaceRef } from "./loyalty.contracts"
import { computeFigures, computeStats } from "./policies/overview.policy"

const DAY_MS = 86_400_000
const WINDOW_DAYS = 30

@Injectable()
/** The statistics and the ribbon of the loyalty workbench, for any member of the workspace. */
export class LoyaltyOverviewService {
    constructor(
        @InjectClock() private readonly clock: Clock,
        private readonly members: WorkspaceMembersService,
        private readonly ledger: LoyaltyLedgerService,
        private readonly programs: LoyaltyProgramsService,
        private readonly campaigns: LoyaltyCampaignsService,
    ) {}

    /** The statistics of the last 30 days and the ribbon figures. */
    async overview(userId: string, params: WorkspaceRef): Promise<LoyaltyOverview> {
        await this.members.require(userId, params.workspaceId)
        const nowMs = this.clock.now().getTime()
        const sinceIso = new Date(nowMs - WINDOW_DAYS * DAY_MS).toISOString()
        const [people, totals, sent, config] = await Promise.all([
            this.ledger.members(params.workspaceId),
            this.ledger.totalsSince(params.workspaceId, sinceIso),
            this.campaigns.sentSince(params.workspaceId, sinceIso),
            this.programs.configOf(params.workspaceId),
        ])
        const stats = computeStats(people, totals, config.tiers, sent, nowMs)
        return { stats, figures: computeFigures(people, stats, nowMs), nowIso: new Date(nowMs).toISOString() }
    }
}
