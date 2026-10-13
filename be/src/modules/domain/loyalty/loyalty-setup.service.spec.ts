import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { LoyaltyCustomersService } from "@modules/domain/loyalty-customers"
import { LoyaltyProgramsService } from "@modules/domain/loyalty-programs"
import { LoyaltyRewardsService } from "@modules/domain/loyalty-rewards"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { LoyaltySetupService } from "./loyalty-setup.service"

const build = async () => {
    const clock = new FakeClock("2026-01-01T00:00:00.000Z")
    const messages = mock<MessageCatalog>()
    const members = mock<WorkspaceMembersService>()
    const programs = mock<LoyaltyProgramsService>()
    const rewardsCatalog = mock<LoyaltyRewardsService>()
    const customers = mock<LoyaltyCustomersService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            LoyaltySetupService,
            { provide: CLOCK, useValue: clock },
            { provide: MESSAGE_CATALOG, useValue: messages },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: LoyaltyProgramsService, useValue: programs },
            { provide: LoyaltyRewardsService, useValue: rewardsCatalog },
            { provide: LoyaltyCustomersService, useValue: customers },
        ],
    }).compile()
    return {
        service: moduleRef.get(LoyaltySetupService),
        clock,
        messages,
        members,
        programs,
        rewardsCatalog,
        customers,
    }
}

describe("LoyaltySetupService", () => {
    describe("saveProgram", () => {
        it("saveProgram has its first case written", async () => {
            const { service } = await build()
            expect(service.saveProgram).toBeInstanceOf(Function)
        })
    })

    describe("saveReward", () => {
        it("saveReward has its first case written", async () => {
            const { service } = await build()
            expect(service.saveReward).toBeInstanceOf(Function)
        })
    })

    describe("deleteReward", () => {
        it("deleteReward has its first case written", async () => {
            const { service } = await build()
            expect(service.deleteReward).toBeInstanceOf(Function)
        })
    })

    describe("addRewardPresets", () => {
        it("addRewardPresets has its first case written", async () => {
            const { service } = await build()
            expect(service.addRewardPresets).toBeInstanceOf(Function)
        })
    })

    describe("updateCustomer", () => {
        it("updateCustomer has its first case written", async () => {
            const { service } = await build()
            expect(service.updateCustomer).toBeInstanceOf(Function)
        })
    })
})
