import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { LoyaltyCustomersService } from "@modules/domain/loyalty-customers"
import { LoyaltyProgramsService } from "@modules/domain/loyalty-programs"
import type { LoyaltyProgram } from "@modules/domain/loyalty-programs"
import { LoyaltyRewardsService } from "@modules/domain/loyalty-rewards"
import type { LoyaltyReward } from "@modules/domain/loyalty-rewards"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { LoyaltyError, LoyaltyErrorCode } from "./errors/loyalty.error"
import { LoyaltySetupService } from "./loyalty-setup.service"
import type { SaveRewardParams } from "./loyalty-setup.contracts"

const PROGRAM: LoyaltyProgram = {
    workspaceId: "ws-1",
    slug: "anna-spa",
    name: "Anna Spa",
    enabled: true,
    config: {
        earn: { perThousandVnd: 1, perVisit: 0, categories: [], trigger: "payment", minOrderVnd: 0 },
        tiers: [],
        expiry: { months: 12, warnDays: 30 },
        birthday: { enabled: true, points: 100, rewardKey: "", note: "" },
        promo: { maxPerMonth: 4, hourFrom: "08:00", hourTo: "21:00", batch: 20 },
    },
    createdAt: "2026-01-01T00:00:00.000Z",
}
const REWARD: LoyaltyReward = {
    id: "reward-1",
    key: "voucher",
    name: "Voucher",
    kind: "voucher",
    valueVnd: 50000,
    percent: null,
    pointsCost: 500,
    stock: null,
    perCustomerLimit: null,
    minTierKey: null,
    note: "At the counter",
    active: true,
}
const REWARD_PARAMS: SaveRewardParams = { workspaceId: "ws-1", ...REWARD }

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
        it("propagates a programme storage failure", async () => {
            const { service, programs } = await build()
            const failure = new Error("operation refused")
            programs.save.mockRejectedValue(failure)
            expect(service.saveProgram).toBeInstanceOf(Function)

            await expect(service.saveProgram("user-1", { workspaceId: "ws-1" })).rejects.toBe(failure)
        })

        it("authorizes managers and forwards the submitted programme fields", async () => {
            const { service, members, programs } = await build()
            const params = { workspaceId: "ws-1", name: "Anna Spa", enabled: true, config: PROGRAM.config }
            programs.save.mockResolvedValue(PROGRAM)

            await expect(service.saveProgram("user-1", params)).resolves.toBe(PROGRAM)
            expect(members.require).toHaveBeenCalledWith("user-1", "ws-1", ["owner", "manager"])
            expect(programs.save).toHaveBeenCalledWith("ws-1", params)
        })

        it("refuses a programme that storage could not save", async () => {
            const { service, programs } = await build()
            programs.save.mockResolvedValue(null)

            await expect(service.saveProgram("user-1", { workspaceId: "ws-1" })).rejects.toMatchObject({
                code: LoyaltyErrorCode.ProgramNotSaved,
                params: {},
            })
        })

        it("does not save a programme when authorization rejects the caller", async () => {
            const { service, members, programs } = await build()
            const refusal = new LoyaltyError({ code: LoyaltyErrorCode.ProgramOff })
            members.require.mockRejectedValue(refusal)

            await expect(service.saveProgram("user-1", { workspaceId: "ws-1" })).rejects.toBe(refusal)
            expect(programs.save).not.toHaveBeenCalled()
        })
    })
})

describe("LoyaltySetupService", () => {
    describe("saveReward", () => {
        it("does not save rewards when authorization fails", async () => {
            const { service, members, rewardsCatalog } = await build()
            const failure = new Error("operation refused")
            members.require.mockRejectedValue(failure)
            expect(service.saveReward).toBeInstanceOf(Function)

            await expect(service.saveReward("user-1", REWARD_PARAMS)).rejects.toBe(failure)
            expect(rewardsCatalog.save).not.toHaveBeenCalled()
        })

        it("authorizes managers and saves a valid reward without altering its fields", async () => {
            const { service, members, rewardsCatalog } = await build()
            const params = { ...REWARD_PARAMS, name: " Voucher ", pointsCost: 0.5 }
            rewardsCatalog.save.mockResolvedValue(REWARD)

            await expect(service.saveReward("user-1", params)).resolves.toBe(REWARD)
            expect(members.require).toHaveBeenCalledWith("user-1", "ws-1", ["owner", "manager"])
            expect(rewardsCatalog.save).toHaveBeenCalledWith("ws-1", params)
        })

        it("rejects an empty display name before saving the reward", async () => {
            const { service, rewardsCatalog } = await build()

            await expect(service.saveReward("user-1", { ...REWARD_PARAMS, name: " \t " })).rejects.toMatchObject({
                code: LoyaltyErrorCode.RewardNameRequired,
                params: {},
            })
            expect(rewardsCatalog.save).not.toHaveBeenCalled()
        })

        it.each([Number.NaN, Number.POSITIVE_INFINITY, 0.49, -1])(
            "rejects an invalid points cost of %s",
            async (pointsCost) => {
                const { service, rewardsCatalog } = await build()

                await expect(service.saveReward("user-1", { ...REWARD_PARAMS, pointsCost })).rejects.toMatchObject({
                    code: LoyaltyErrorCode.RewardPointsInvalid,
                    params: {},
                })
                expect(rewardsCatalog.save).not.toHaveBeenCalled()
            },
        )

        it("identifies a new reward that storage could not save", async () => {
            const { service, rewardsCatalog } = await build()
            rewardsCatalog.save.mockResolvedValue(null)

            await expect(service.saveReward("user-1", { ...REWARD_PARAMS, id: undefined })).rejects.toMatchObject({
                code: LoyaltyErrorCode.RewardNotSaved,
                params: {},
            })
        })

        it("identifies an existing reward that no longer exists", async () => {
            const { service, rewardsCatalog } = await build()
            rewardsCatalog.save.mockResolvedValue(null)

            await expect(service.saveReward("user-1", REWARD_PARAMS)).rejects.toMatchObject({
                code: LoyaltyErrorCode.RewardNotFound,
                params: {},
            })
        })
    })
})

describe("LoyaltySetupService", () => {
    describe("deleteReward", () => {
        it("does not delete rewards when authorization fails", async () => {
            const { service, members, rewardsCatalog } = await build()
            const failure = new Error("operation refused")
            members.require.mockRejectedValue(failure)
            expect(service.deleteReward).toBeInstanceOf(Function)

            await expect(service.deleteReward("user-1", { workspaceId: "ws-1", rewardId: "reward-1" })).rejects.toBe(
                failure,
            )
            expect(rewardsCatalog.remove).not.toHaveBeenCalled()
        })

        it.each<readonly ["deleted" | "retired" | "missing", boolean]>([
            ["deleted", true],
            ["retired", true],
            ["missing", false],
        ])("reports a %s removal as deleted=%s", async (removed, deleted) => {
            const { service, members, rewardsCatalog } = await build()
            rewardsCatalog.remove.mockResolvedValue(removed)

            await expect(
                service.deleteReward("user-1", { workspaceId: "ws-1", rewardId: "reward-1" }),
            ).resolves.toEqual({ deleted })
            expect(members.require).toHaveBeenCalledWith("user-1", "ws-1", ["owner", "manager"])
            expect(rewardsCatalog.remove).toHaveBeenCalledWith("ws-1", "reward-1")
        })
    })
})

describe("LoyaltySetupService", () => {
    describe("addRewardPresets", () => {
        it("does not add presets when authorization fails", async () => {
            const { service, members, rewardsCatalog } = await build()
            const failure = new Error("operation refused")
            members.require.mockRejectedValue(failure)
            expect(service.addRewardPresets).toBeInstanceOf(Function)

            await expect(service.addRewardPresets("user-1", { workspaceId: "ws-1" })).rejects.toBe(failure)
            expect(rewardsCatalog.addPresets).not.toHaveBeenCalled()
        })

        it("authorizes managers and passes the starter catalogue with localized wording", async () => {
            const { service, members, messages, rewardsCatalog } = await build()
            messages.get.mockImplementation((key) => `vi:${key}`)
            rewardsCatalog.addPresets.mockResolvedValue(2)

            await expect(service.addRewardPresets("user-1", { workspaceId: "ws-1" })).resolves.toEqual({ added: 2 })
            expect(members.require).toHaveBeenCalledWith("user-1", "ws-1", ["owner", "manager"])
            expect(rewardsCatalog.addPresets).toHaveBeenCalledWith("ws-1", [
                {
                    key: "voucher-50k",
                    kind: "voucher",
                    valueVnd: 50000,
                    percent: null,
                    pointsCost: 500,
                    stock: null,
                    perCustomerLimit: null,
                    minTierKey: null,
                    name: "vi:loyalty.rewardPreset.voucher50k.name",
                    note: "vi:loyalty.rewardPreset.voucher50k.note",
                    active: true,
                },
                {
                    key: "giam-10",
                    kind: "percent",
                    valueVnd: 100000,
                    percent: 10,
                    pointsCost: 800,
                    stock: null,
                    perCustomerLimit: 2,
                    minTierKey: null,
                    name: "vi:loyalty.rewardPreset.percent10.name",
                    note: "vi:loyalty.rewardPreset.percent10.note",
                    active: true,
                },
                {
                    key: "qua-tang",
                    kind: "item",
                    valueVnd: 150000,
                    percent: null,
                    pointsCost: 1200,
                    stock: 20,
                    perCustomerLimit: 1,
                    minTierKey: "bac",
                    name: "vi:loyalty.rewardPreset.shopGift.name",
                    note: "vi:loyalty.rewardPreset.shopGift.note",
                    active: true,
                },
            ])
            expect(messages.get.mock.calls).toEqual([
                ["loyalty.rewardPreset.voucher50k.name", {}, "vi"],
                ["loyalty.rewardPreset.voucher50k.note", {}, "vi"],
                ["loyalty.rewardPreset.percent10.name", {}, "vi"],
                ["loyalty.rewardPreset.percent10.note", {}, "vi"],
                ["loyalty.rewardPreset.shopGift.name", {}, "vi"],
                ["loyalty.rewardPreset.shopGift.note", {}, "vi"],
            ])
        })
    })
})

describe("LoyaltySetupService", () => {
    describe("updateCustomer", () => {
        it("does not update customer profiles when authorization fails", async () => {
            const { service, members, customers } = await build()
            const failure = new Error("operation refused")
            members.require.mockRejectedValue(failure)
            expect(service.updateCustomer).toBeInstanceOf(Function)

            await expect(
                service.updateCustomer("user-1", { workspaceId: "ws-1", customerId: "customer-1" }),
            ).rejects.toBe(failure)
            expect(customers.updateProfile).not.toHaveBeenCalled()
        })

        it.each([undefined, null, "1900-01-01", "2026-01-01"])(
            "saves the profile with birthday %s",
            async (birthday) => {
                const { service, members, customers } = await build()
                const params = { workspaceId: "ws-1", customerId: "customer-1", name: "Mai", birthday, note: "Regular" }
                customers.updateProfile.mockResolvedValue(true)

                await expect(service.updateCustomer("user-1", params)).resolves.toEqual({ updated: true })
                expect(members.require).toHaveBeenCalledWith("user-1", "ws-1", ["owner", "manager"])
                expect(customers.updateProfile).toHaveBeenCalledWith("ws-1", "customer-1", params)
            },
        )

        it("uses the Vietnam calendar day when validating a birthday", async () => {
            const { service, clock, customers } = await build()
            clock.set("2026-01-01T20:00:00.000Z")
            customers.updateProfile.mockResolvedValue(true)
            const params = { workspaceId: "ws-1", customerId: "customer-1", birthday: "2026-01-02" }

            await expect(service.updateCustomer("user-1", params)).resolves.toEqual({ updated: true })
            expect(customers.updateProfile).toHaveBeenCalledWith("ws-1", "customer-1", params)
        })

        it.each(["invalid", "2025-02-29", "1899-12-31", "2026-01-02"])(
            "rejects an invalid birthday of %s",
            async (birthday) => {
                const { service, customers } = await build()

                await expect(
                    service.updateCustomer("user-1", { workspaceId: "ws-1", customerId: "customer-1", birthday }),
                ).rejects.toMatchObject({ code: LoyaltyErrorCode.BirthdayInvalid, params: {} })
                expect(customers.updateProfile).not.toHaveBeenCalled()
            },
        )

        it("refuses to update a customer that does not belong to the workspace", async () => {
            const { service, customers } = await build()
            customers.updateProfile.mockResolvedValue(false)
            const params = { workspaceId: "ws-1", customerId: "customer-1", birthday: null }

            await expect(service.updateCustomer("user-1", params)).rejects.toMatchObject({
                code: LoyaltyErrorCode.MemberNotFound,
                params: {},
            })
            expect(customers.updateProfile).toHaveBeenCalledWith("ws-1", "customer-1", params)
        })
    })
})
