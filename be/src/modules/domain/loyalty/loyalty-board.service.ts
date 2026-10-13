import { Injectable } from "@nestjs/common"
import { LoyaltyCampaignsService } from "@modules/domain/loyalty-campaigns"
import { LoyaltyLedgerService } from "@modules/domain/loyalty-ledger"
import { LoyaltyProgramsService } from "@modules/domain/loyalty-programs"
import { LoyaltyRewardsService } from "@modules/domain/loyalty-rewards"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { LoyaltyOverviewService } from "./loyalty-overview.service"
import type { LoyaltyBoard, LoyaltyProgramSettings } from "./loyalty-board.contracts"
import type { WorkspaceRef } from "./loyalty.contracts"

const CAMPAIGNS_LIMIT = 20

@Injectable()
/** Reads the loyalty workbench and settings without creating programme rows. */
export class LoyaltyBoardService {
    constructor(
        private readonly access: WorkspaceMembersService,
        private readonly overview: LoyaltyOverviewService,
        private readonly programs: LoyaltyProgramsService,
        private readonly ledger: LoyaltyLedgerService,
        private readonly rewards: LoyaltyRewardsService,
        private readonly campaigns: LoyaltyCampaignsService,
    ) {}

    /** Lists the workbench tabs and figures after proving workspace membership. */
    async board(userId: string, params: WorkspaceRef): Promise<LoyaltyBoard> {
        const actor = await this.access.require(userId, params.workspaceId)
        const [overview, program, config, members, rewards, campaigns] = await Promise.all([
            this.overview.overview(userId, params),
            this.programs.find(params.workspaceId),
            this.programs.configOf(params.workspaceId),
            this.ledger.members(params.workspaceId),
            this.rewards.list(params.workspaceId, false),
            this.campaigns.list(params.workspaceId, CAMPAIGNS_LIMIT),
        ])
        return {
            ...overview,
            program,
            config,
            members,
            rewards,
            campaigns,
            canManage: actor.role === "owner" || actor.role === "manager",
        }
    }

    /** Returns saved settings or starter rules, and active birthday reward choices. */
    async program(userId: string, params: WorkspaceRef): Promise<LoyaltyProgramSettings> {
        await this.access.require(userId, params.workspaceId)
        const [program, config, rewards] = await Promise.all([
            this.programs.find(params.workspaceId),
            this.programs.configOf(params.workspaceId),
            this.rewards.list(params.workspaceId, true),
        ])
        return { program, config, rewards }
    }
}
