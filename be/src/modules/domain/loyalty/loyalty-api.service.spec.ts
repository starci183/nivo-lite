import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { ApiKeysService } from "@modules/domain/api-keys"
import { LoyaltyCampaignsService } from "@modules/domain/loyalty-campaigns"
import type { Segment } from "@modules/domain/loyalty-campaigns"
import { LoyaltyCustomersService } from "@modules/domain/loyalty-customers"
import { LoyaltyLedgerService } from "@modules/domain/loyalty-ledger"
import type { LoyaltyMember } from "@modules/domain/loyalty-ledger"
import { LoyaltyProgramsService } from "@modules/domain/loyalty-programs"
import type { LoyaltyProgram } from "@modules/domain/loyalty-programs"
import { LoyaltyRewardsService } from "@modules/domain/loyalty-rewards"
import type { LoyaltyReward } from "@modules/domain/loyalty-rewards"
import { LoyaltyErrorCode } from "./errors/loyalty.error"
import { LoyaltyApiService } from "./loyalty-api.service"
import { LoyaltyEarningService } from "./loyalty-earning.service"
import { LoyaltyRedemptionService } from "./loyalty-redemption.service"

const PRINCIPAL = {
    keyId: "key-12345678",
    workspaceId: "ws-1",
    name: "Till",
    scopes: ["loyalty:read", "loyalty:write"],
}
const HEADER = "Bearer nvk_secret"
const program: LoyaltyProgram = {
    workspaceId: "ws-1",
    slug: "spa",
    name: "Spa",
    enabled: true,
    createdAt: "x",
    config: {
        earn: { perThousandVnd: 1, perVisit: 0, categories: [], trigger: "payment", minOrderVnd: 0 },
        tiers: [{ key: "dong", name: "Bronze", minSpendVnd: 0, multiplier: 1, winbackDays: 60, benefit: "" }],
        expiry: { months: 12, warnDays: 30 },
        birthday: { enabled: true, points: 100, rewardKey: "", note: "" },
        promo: { maxPerMonth: 4, hourFrom: "08:00", hourTo: "21:00", batch: 20 },
    },
}
const CUSTOMER = {
    id: "c1",
    name: "Mai",
    phone: "84912345678",
    email: null,
    birthday: null,
    tierKey: "dong",
    joinedAt: "x",
    note: "",
}
const memberOf = builder<LoyaltyMember>({
    id: "c1",
    name: "Mai",
    phone: "84912345678",
    email: null,
    birthday: null,
    tierKey: "dong",
    points: 600,
    lifetimeSpendVnd: 1000,
    visits: 2,
    lastVisitAt: "2026-10-10T00:00:00.000Z",
    joinedAt: "x",
    note: "",
})
const VIEW = {
    customerId: "c1",
    name: "Mai",
    phone: "84912345678",
    email: null,
    tier: "Bronze",
    points: 600,
    lifetimeSpendVnd: 1000,
    visits: 2,
    lastVisitAt: "2026-10-10T00:00:00.000Z",
}
const REWARD: LoyaltyReward = {
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
}
const SEGMENT: Segment = { tiers: [], inactiveDays: 0, birthdayThisMonth: false, minSpendVnd: 0 }

interface Options {
    program?: LoyaltyProgram | null
    customer?: typeof CUSTOMER | null
    member?: LoyaltyMember | null
    reward?: LoyaltyReward | null
    posted?: boolean
}

const build = async (options: Options = {}) => {
    const keys = mock<ApiKeysService>()
    keys.authenticate.mockResolvedValue(PRINCIPAL)
    const programs = mock<LoyaltyProgramsService>()
    programs.findActive.mockResolvedValue(options.program === undefined ? program : options.program)
    const customers = mock<LoyaltyCustomersService>()
    customers.byPhone.mockResolvedValue(options.customer === undefined ? CUSTOMER : options.customer)
    customers.byId.mockResolvedValue(options.customer === undefined ? CUSTOMER : options.customer)
    const ledger = mock<LoyaltyLedgerService>()
    ledger.member.mockResolvedValue(options.member === undefined ? memberOf() : options.member)
    ledger.members.mockResolvedValue([memberOf(), memberOf({ id: "c2", tierKey: null })])
    const rewards = mock<LoyaltyRewardsService>()
    rewards.byKey.mockResolvedValue(options.reward === undefined ? REWARD : options.reward)
    const earning = mock<LoyaltyEarningService>()
    earning.earn.mockResolvedValue({ customerId: "c1", status: "done" })
    const redemption = mock<LoyaltyRedemptionService>()
    redemption.redeem.mockResolvedValue({ code: "QT-1", posted: options.posted ?? true, reward: REWARD })
    const campaigns = mock<LoyaltyCampaignsService>()
    campaigns.create.mockResolvedValue({ campaignId: "k1", status: "draft", recipients: 2, draft: "Hello" })
    const moduleRef = await Test.createTestingModule({
        providers: [
            LoyaltyApiService,
            { provide: ApiKeysService, useValue: keys },
            { provide: LoyaltyProgramsService, useValue: programs },
            { provide: LoyaltyCustomersService, useValue: customers },
            { provide: LoyaltyLedgerService, useValue: ledger },
            { provide: LoyaltyRewardsService, useValue: rewards },
            { provide: LoyaltyEarningService, useValue: earning },
            { provide: LoyaltyRedemptionService, useValue: redemption },
            { provide: LoyaltyCampaignsService, useValue: campaigns },
        ],
    }).compile()
    return { service: moduleRef.get(LoyaltyApiService), keys, earning, redemption, campaigns }
}

describe("LoyaltyApiService", () => {
    describe("the key", () => {
        it("is checked for the scope of the call with the header the till sent", async () => {
            const { service, keys } = await build()

            await service.members({ authorization: HEADER, phone: "", limit: 10 })

            expect(keys.authenticate).toHaveBeenCalledWith("loyalty:read", HEADER)
        })

        it("is refused when the programme is off", async () => {
            const { service } = await build({ program: null })

            await expect(service.members({ authorization: HEADER, phone: "", limit: 10 })).rejects.toMatchObject({
                code: LoyaltyErrorCode.ProgramOff,
            })
        })
    })

    describe("members", () => {
        it("lists the newest customers up to the limit", async () => {
            const { service } = await build()

            const { members } = await service.members({ authorization: HEADER, limit: 1 })
            const all = await service.members({ authorization: HEADER })

            expect(members).toEqual([VIEW])
            expect(all.members).toHaveLength(2)
        })

        it("finds one customer by phone and shows no tier for a customer without one", async () => {
            const { service } = await build({ member: memberOf({ tierKey: null }) })

            const { members } = await service.members({ authorization: HEADER, phone: "0912 345 678", limit: 10 })

            expect(members).toEqual([{ ...VIEW, tier: null }])
        })

        it("finds nobody for a phone that is no customer, or a customer who cannot be read", async () => {
            const stranger = await build({ customer: null })
            const vanished = await build({ member: null })

            await expect(
                stranger.service.members({ authorization: HEADER, phone: "0912345678", limit: 10 }),
            ).resolves.toEqual({ members: [] })
            await expect(
                vanished.service.members({ authorization: HEADER, phone: "0912345678", limit: 10 }),
            ).resolves.toEqual({ members: [] })
        })

        it("refuses a phone that is not a Vietnamese number", async () => {
            const { service } = await build()

            await expect(service.members({ authorization: HEADER, phone: "12", limit: 10 })).rejects.toMatchObject({
                code: LoyaltyErrorCode.PhoneInvalid,
            })
        })
    })

    describe("award", () => {
        const sale = {
            authorization: HEADER,
            phone: "0912 345 678",
            name: "Mai",
            amountVnd: 100000.4,
            ref: "r-1",
            items: "",
            occurredAt: "",
        }

        it("earns the points of the sale under a key made of the key id and the receipt", async () => {
            const { service, earning } = await build()

            await expect(service.award(sale)).resolves.toEqual({ status: "done", customer: VIEW })

            expect(earning.earn).toHaveBeenCalledWith({
                workspaceId: "ws-1",
                phone: "84912345678",
                name: "Mai",
                amountVnd: 100000,
                items: "",
                ref: "pos:key-1234:r-1",
                by: "api:Till",
                occurredAt: "",
            })
        })

        it("refuses an amount that is not positive and a customer who cannot be read back", async () => {
            const { service } = await build()
            const vanished = await build({ member: null })

            await expect(service.award({ ...sale, amountVnd: 0 })).rejects.toMatchObject({
                code: LoyaltyErrorCode.AmountInvalid,
            })
            await expect(service.award({ ...sale, amountVnd: Number.NaN })).rejects.toMatchObject({
                code: LoyaltyErrorCode.AmountInvalid,
            })
            await expect(vanished.service.award(sale)).rejects.toMatchObject({ code: LoyaltyErrorCode.MemberNotFound })
        })
    })

    describe("redeem", () => {
        const call = {
            authorization: HEADER,
            phone: "0912 345 678",
            customerId: "",
            rewardKey: "voucher",
            ref: "ref-1",
        }

        it("redeems the reward for the customer of a phone", async () => {
            const { service, redemption } = await build()

            await expect(service.redeem(call)).resolves.toEqual({
                status: "done",
                code: "QT-1",
                reward: { key: "voucher", name: "Voucher", valueVnd: 50000, pointsCost: 500 },
                customer: VIEW,
            })

            expect(redemption.redeem).toHaveBeenCalledWith({
                workspaceId: "ws-1",
                customerId: "c1",
                rewardId: "r1",
                ref: "redeem:api:key-1234:ref-1",
                by: "api:Till",
            })
        })

        it("redeems for a customer named by id and reports a key used before as a duplicate", async () => {
            const { service } = await build({ posted: false })

            const result = await service.redeem({ ...call, phone: "", customerId: "c1" })

            expect(result.status).toBe("duplicate")
        })

        it("refuses a call without a customer, an unknown customer and an unknown reward", async () => {
            const { service } = await build()
            const stranger = await build({ customer: null })
            const noReward = await build({ reward: null })

            await expect(service.redeem({ ...call, phone: "" })).rejects.toMatchObject({
                code: LoyaltyErrorCode.ContactRequired,
            })
            await expect(stranger.service.redeem(call)).rejects.toMatchObject({ code: LoyaltyErrorCode.MemberNotFound })
            await expect(noReward.service.redeem(call)).rejects.toMatchObject({ code: LoyaltyErrorCode.RewardNotFound })
        })
    })

    describe("promo", () => {
        it("drafts a promotion in the name of the key", async () => {
            const { service, campaigns } = await build()

            await expect(
                service.promo({ authorization: HEADER, name: "Autumn", brief: "10 percent", segment: SEGMENT }),
            ).resolves.toMatchObject({
                campaignId: "k1",
            })

            expect(campaigns.create).toHaveBeenCalledWith({
                workspaceId: "ws-1",
                name: "Autumn",
                segment: SEGMENT,
                brief: "10 percent",
                createdBy: "api:Till",
            })
        })
    })
})
