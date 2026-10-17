import { Test } from "@nestjs/testing"
import { FakeClock, builder, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { LoyaltyCustomerLinksService } from "@modules/domain/loyalty-customer-links"
import { LoyaltyCustomersService } from "@modules/domain/loyalty-customers"
import { LoyaltyLedgerService } from "@modules/domain/loyalty-ledger"
import type { LoyaltyMember } from "@modules/domain/loyalty-ledger"
import { LoyaltyProgramsService } from "@modules/domain/loyalty-programs"
import type { LoyaltyConfig } from "@modules/domain/loyalty-programs"
import { LoyaltyRewardsService } from "@modules/domain/loyalty-rewards"
import type { LoyaltyReward } from "@modules/domain/loyalty-rewards"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LoyaltyErrorCode } from "./errors/loyalty.error"
import { LoyaltyMembersService } from "./loyalty-members.service"
import { LoyaltyRedemptionService } from "./loyalty-redemption.service"

const NOW = Date.UTC(2026, 9, 12)
const DAY = 86_400_000
const CONFIG: LoyaltyConfig = {
    earn: { perThousandVnd: 1, perVisit: 0, categories: [], trigger: "payment", minOrderVnd: 0 },
    tiers: [
        { key: "dong", name: "Bronze", minSpendVnd: 0, multiplier: 1, winbackDays: 60, benefit: "" },
        { key: "bac", name: "Silver", minSpendVnd: 3_000_000, multiplier: 1.2, winbackDays: 45, benefit: "" },
    ],
    expiry: { months: 12, warnDays: 30 },
    birthday: { enabled: true, points: 100, rewardKey: "", note: "" },
    promo: { maxPerMonth: 4, hourFrom: "08:00", hourTo: "21:00", batch: 20 },
}
const memberOf = builder<LoyaltyMember>({
    id: "c1",
    name: "Mai",
    phone: null,
    email: null,
    birthday: null,
    tierKey: "dong",
    points: 600,
    lifetimeSpendVnd: 1_000_000,
    visits: 1,
    lastVisitAt: null,
    joinedAt: new Date(NOW).toISOString(),
    note: "",
})
const rewardOf = builder<LoyaltyReward>({
    id: "r1",
    key: "voucher",
    name: "Voucher",
    kind: "voucher",
    valueVnd: 50000,
    percent: null,
    pointsCost: 500,
    stock: null,
    perCustomerLimit: null,
    minTierKey: null,
    note: "",
    active: true,
})
const ACTOR = {
    userId: "user-1",
    workspaceId: "ws-1",
    role: "manager" as const,
    staffId: null,
    displayName: "Owner Anna",
    status: "active" as const,
}

const build = async (
    options: { config?: LoyaltyConfig; member?: LoyaltyMember | null; posted?: string | null } = {},
) => {
    const tx = fakeTransaction(mockEntityManager())
    const access = mock<WorkspaceMembersService>()
    access.require.mockResolvedValue(ACTOR)
    const customers = mock<LoyaltyCustomersService>()
    const lead = { id: "l1", name: "A", phone: "84912345678", email: null }
    customers.leadContacts.mockResolvedValue([lead])
    customers.createFromLeads.mockResolvedValue(1)
    const links = mock<LoyaltyCustomerLinksService>()
    links.linkLeads.mockResolvedValue(1)
    const ledger = mock<LoyaltyLedgerService>()
    ledger.member.mockResolvedValue(options.member === undefined ? memberOf() : options.member)
    ledger.timeline.mockResolvedValue([])
    ledger.redeemedCounts.mockResolvedValue(new Map())
    ledger.expiryEntries.mockResolvedValue([
        { kind: "earn", points: 10, expiresAt: new Date(NOW + 5 * DAY).toISOString() },
    ])
    ledger.post.mockResolvedValue(options.posted === undefined ? "e1" : options.posted)
    const programs = mock<LoyaltyProgramsService>()
    programs.configOf.mockResolvedValue(options.config ?? CONFIG)
    const rewards = mock<LoyaltyRewardsService>()
    rewards.list.mockResolvedValue([rewardOf(), rewardOf({ id: "r2", pointsCost: 5000 })])
    const redemption = mock<LoyaltyRedemptionService>()
    redemption.redeem.mockResolvedValue({ code: "QT-1", posted: true, reward: rewardOf() })
    const moduleRef = await Test.createTestingModule({
        providers: [
            LoyaltyMembersService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: WorkspaceMembersService, useValue: access },
            { provide: LoyaltyCustomersService, useValue: customers },
            { provide: LoyaltyCustomerLinksService, useValue: links },
            { provide: LoyaltyLedgerService, useValue: ledger },
            { provide: LoyaltyProgramsService, useValue: programs },
            { provide: LoyaltyRewardsService, useValue: rewards },
            { provide: LoyaltyRedemptionService, useValue: redemption },
        ],
    }).compile()
    return { service: moduleRef.get(LoyaltyMembersService), access, customers, links, ledger, redemption }
}

describe("LoyaltyMembersService", () => {
    describe("detail", () => {
        it("shows the customer timeline, tier progress, expiring points and rewards", async () => {
            const { service, access } = await build()

            const detail = await service.detail("user-1", { workspaceId: "ws-1", customerId: "c1" })

            expect(access.require).toHaveBeenCalledWith("user-1", "ws-1")
            expect(detail.member.id).toBe("c1")
            expect(detail.tierName).toBe("Bronze")
            expect(detail.nextTier).toEqual({ tier: CONFIG.tiers[1], missingVnd: 2_000_000 })
            expect(detail.expiring).toEqual({ points: 10, firstAt: new Date(NOW + 5 * DAY).toISOString() })
            expect(detail.rewards.map((option) => option.block?.code ?? null)).toEqual([null, "not_enough_points"])
        })

        it("omits nonexpiring points and an absent customer tier", async () => {
            const config = { ...CONFIG, expiry: { months: 0, warnDays: 30 } }
            const { service } = await build({ config, member: memberOf({ tierKey: null }) })

            const detail = await service.detail("user-1", { workspaceId: "ws-1", customerId: "c1" })

            expect(detail.expiring).toEqual({ points: 0, firstAt: null })
            expect(detail.tierName).toBe("")
        })

        it("fails for a customer the workspace does not have", async () => {
            const { service } = await build({ member: null })

            await expect(service.detail("user-1", { workspaceId: "ws-1", customerId: "zzz" })).rejects.toMatchObject({
                code: LoyaltyErrorCode.MemberNotFound,
            })
        })
    })
})

describe("LoyaltyMembersService", () => {
    describe("adjust", () => {
        const adjust = { workspaceId: "ws-1", customerId: "c1", points: 25.4, reason: "  goodwill ", token: "tok-1" }

        it("writes the correction in the name of the manager", async () => {
            const { service, access, ledger } = await build()

            await expect(service.adjust("user-1", adjust)).resolves.toEqual({ posted: true })

            expect(access.require).toHaveBeenCalledWith("user-1", "ws-1", ["owner", "manager"])
            expect(ledger.post).toHaveBeenCalledWith({
                manager: expect.anything(),
                workspaceId: "ws-1",
                customerId: "c1",
                kind: "adjust",
                points: 25,
                ref: "adjust:tok-1",
                by: "Owner Anna",
                amountVnd: null,
                orderId: null,
                invoiceId: null,
                rewardId: null,
                evidence: "goodwill",
                expiresAt: null,
                occurredAt: new Date(NOW).toISOString(),
            })
        })

        it("tells when the token was used before", async () => {
            const { service } = await build({ posted: null })

            await expect(service.adjust("user-1", adjust)).resolves.toEqual({ posted: false })
        })

        it("refuses zero points and a missing reason", async () => {
            const { service, ledger } = await build()

            await expect(service.adjust("user-1", { ...adjust, points: 0.2 })).rejects.toMatchObject({
                code: LoyaltyErrorCode.PointsRequired,
            })
            await expect(service.adjust("user-1", { ...adjust, reason: "  " })).rejects.toMatchObject({
                code: LoyaltyErrorCode.ReasonRequired,
            })
            expect(ledger.post).not.toHaveBeenCalled()
        })
    })

    describe("redeem", () => {
        it("redeems through the redemption service in the name of the member", async () => {
            const { service, redemption } = await build()

            await expect(
                service.redeem("user-1", { workspaceId: "ws-1", customerId: "c1", rewardId: "r1", token: "tok-2" }),
            ).resolves.toEqual({
                code: "QT-1",
                posted: true,
            })

            expect(redemption.redeem).toHaveBeenCalledWith({
                workspaceId: "ws-1",
                customerId: "c1",
                rewardId: "r1",
                ref: "redeem:tok-2",
                by: "Owner Anna",
            })
        })
    })
})

describe("LoyaltyMembersService", () => {
    describe("sync", () => {
        it("makes customers of the leads and links them in one transaction", async () => {
            const { service, access, customers, links } = await build()

            await expect(service.sync("user-1", { workspaceId: "ws-1" })).resolves.toEqual({ created: 1, linked: 1 })

            expect(access.require).toHaveBeenCalledWith("user-1", "ws-1", ["owner", "manager"])
            expect(customers.createFromLeads).toHaveBeenCalledWith(expect.anything(), "ws-1", [
                { id: "l1", name: "A", phone: "84912345678", email: null },
            ])
            expect(links.linkLeads).toHaveBeenCalledWith(expect.anything(), "ws-1", [
                { id: "l1", name: "A", phone: "84912345678", email: null },
            ])
        })
    })
})
