import { Test } from "@nestjs/testing"
import { FakeClock, builder, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { LoyaltyLedgerService } from "@modules/domain/loyalty-ledger"
import type { LoyaltyMember } from "@modules/domain/loyalty-ledger"
import { LoyaltyProgramsService } from "@modules/domain/loyalty-programs"
import type { LoyaltyConfig } from "@modules/domain/loyalty-programs"
import { LoyaltyRewardsService } from "@modules/domain/loyalty-rewards"
import type { LoyaltyReward } from "@modules/domain/loyalty-rewards"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { LoyaltyErrorCode } from "./errors/loyalty.error"
import { LoyaltyRedemptionService } from "./loyalty-redemption.service"
import type { RedemptionParams } from "./loyalty-redemption.service"

const NOW = Date.UTC(2026, 9, 12)
const CONFIG: LoyaltyConfig = {
    earn: { perThousandVnd: 1, perVisit: 0, categories: [], trigger: "payment", minOrderVnd: 0 },
    tiers: [{ key: "dong", name: "Bronze", minSpendVnd: 0, multiplier: 1, winbackDays: 60, benefit: "" }],
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
    lifetimeSpendVnd: 0,
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
    stock: 5,
    perCustomerLimit: null,
    minTierKey: null,
    note: "",
    active: true,
})
const paramsOf = builder<RedemptionParams>({
    workspaceId: "ws-1",
    customerId: "c1",
    rewardId: "r1",
    ref: "redeem:ab12cd34",
    by: "Owner",
})
const catalog: MessageCatalog = { get: (key, params) => `${key}:${String(params.name)}:${String(params.code)}` }

interface Options {
    member?: LoyaltyMember | null
    reward?: LoyaltyReward | null
    seen?: boolean
    posted?: string | null
    counts?: Map<string, number>
}

const build = async (options: Options) => {
    const tx = fakeTransaction(mockEntityManager())
    const ledger = mock<LoyaltyLedgerService>()
    ledger.member.mockResolvedValue(options.member === undefined ? memberOf() : options.member)
    ledger.redeemedCounts.mockResolvedValue(options.counts ?? new Map())
    ledger.hasRef.mockResolvedValue(options.seen ?? false)
    ledger.post.mockResolvedValue(options.posted === undefined ? "e1" : options.posted)
    const rewards = mock<LoyaltyRewardsService>()
    rewards.lock.mockResolvedValue(options.reward === undefined ? rewardOf() : options.reward)
    rewards.takeOne.mockResolvedValue(undefined)
    const programs = mock<LoyaltyProgramsService>()
    programs.configOf.mockResolvedValue(CONFIG)
    const moduleRef = await Test.createTestingModule({
        providers: [
            LoyaltyRedemptionService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: LoyaltyLedgerService, useValue: ledger },
            { provide: LoyaltyRewardsService, useValue: rewards },
            { provide: LoyaltyProgramsService, useValue: programs },
        ],
    }).compile()
    return { service: moduleRef.get(LoyaltyRedemptionService), ledger, rewards, tx }
}

describe("LoyaltyRedemptionService", () => {
    it("takes the points and one unit of stock and answers the code", async () => {
        const { service, ledger, rewards, tx } = await build({})

        await expect(service.redeem(paramsOf())).resolves.toEqual({
            code: "QT-12CD34",
            posted: true,
            reward: rewardOf(),
        })

        expect(ledger.post).toHaveBeenCalledWith({
            manager: expect.anything(),
            workspaceId: "ws-1",
            customerId: "c1",
            kind: "redeem",
            points: -500,
            ref: "redeem:ab12cd34",
            by: "Owner",
            amountVnd: 50000,
            orderId: null,
            invoiceId: null,
            rewardId: "r1",
            evidence: "loyalty.redeem.evidence:Voucher:QT-12CD34",
            expiresAt: null,
            occurredAt: new Date(NOW).toISOString(),
        })
        expect(rewards.takeOne).toHaveBeenCalledWith(expect.anything(), "ws-1", "r1")
        expect(tx.commits).toBe(1)
    })

    it("changes nothing when the key was used before", async () => {
        const { service, ledger } = await build({ seen: true })

        await expect(service.redeem(paramsOf())).resolves.toMatchObject({ posted: false })
        expect(ledger.post).not.toHaveBeenCalled()
    })

    it("does not take stock when the ledger answers that the key was posted meanwhile", async () => {
        const { service, rewards } = await build({ posted: null })

        await expect(service.redeem(paramsOf())).resolves.toMatchObject({ posted: false })
        expect(rewards.takeOne).not.toHaveBeenCalled()
    })

    it("refuses a customer or a reward that is not there", async () => {
        const noMember = await build({ member: null })
        const noReward = await build({ reward: null })

        await expect(noMember.service.redeem(paramsOf())).rejects.toMatchObject({
            code: LoyaltyErrorCode.MemberNotFound,
        })
        await expect(noReward.service.redeem(paramsOf())).rejects.toMatchObject({
            code: LoyaltyErrorCode.RewardNotFound,
        })
    })

    it("refuses a reward the customer cannot redeem and says why", async () => {
        const { service, ledger } = await build({ member: memberOf({ points: 100 }) })

        await expect(service.redeem(paramsOf())).rejects.toMatchObject({
            code: LoyaltyErrorCode.NotRedeemable,
            params: { reason: "not_enough_points", cost: 500, points: 100 },
        })
        expect(ledger.post).not.toHaveBeenCalled()
    })

    it("counts the redemptions the customer made before against the limit", async () => {
        const { service } = await build({ reward: rewardOf({ perCustomerLimit: 1 }), counts: new Map([["r1", 1]]) })

        await expect(service.redeem(paramsOf())).rejects.toMatchObject({
            params: { reason: "limit_reached", limit: 1 },
        })
    })
})
