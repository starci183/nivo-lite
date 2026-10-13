import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { LoyaltyCampaignsService } from "@modules/domain/loyalty-campaigns"
import { LoyaltyLedgerService } from "@modules/domain/loyalty-ledger"
import { LoyaltyProgramsService } from "@modules/domain/loyalty-programs"
import { LoyaltyRewardsService } from "@modules/domain/loyalty-rewards"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { LoyaltyOverviewService } from "./loyalty-overview.service"
import { LoyaltyBoardService } from "./loyalty-board.service"

const build = async () => {
    const access = mock<WorkspaceMembersService>()
    const overview = mock<LoyaltyOverviewService>()
    const programs = mock<LoyaltyProgramsService>()
    const ledger = mock<LoyaltyLedgerService>()
    const rewards = mock<LoyaltyRewardsService>()
    const campaigns = mock<LoyaltyCampaignsService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            LoyaltyBoardService,
            { provide: WorkspaceMembersService, useValue: access },
            { provide: LoyaltyOverviewService, useValue: overview },
            { provide: LoyaltyProgramsService, useValue: programs },
            { provide: LoyaltyLedgerService, useValue: ledger },
            { provide: LoyaltyRewardsService, useValue: rewards },
            { provide: LoyaltyCampaignsService, useValue: campaigns },
        ],
    }).compile()
    return { service: moduleRef.get(LoyaltyBoardService), access, overview, programs, ledger, rewards, campaigns }
}

describe("LoyaltyBoardService", () => {
    describe("board", () => {
        it("board has its first case written", async () => {
            const { service } = await build()
            expect(service.board).toBeInstanceOf(Function)
        })
    })

    describe("program", () => {
        it("program has its first case written", async () => {
            const { service } = await build()
            expect(service.program).toBeInstanceOf(Function)
        })
    })
})
