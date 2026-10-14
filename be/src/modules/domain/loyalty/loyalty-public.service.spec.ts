import { Test } from "@nestjs/testing"
import { FakeClock, builder, mock } from "@starci/jest-preset"
import { LoyaltyCustomerLinksService } from "@modules/domain/loyalty-customer-links"
import { LoyaltyCustomersService } from "@modules/domain/loyalty-customers"
import { LoyaltyLedgerService } from "@modules/domain/loyalty-ledger"
import type { LoyaltyMember } from "@modules/domain/loyalty-ledger"
import { LoyaltyOtpsService } from "@modules/domain/loyalty-otps"
import { LoyaltyProgramsService } from "@modules/domain/loyalty-programs"
import type { LoyaltyProgram } from "@modules/domain/loyalty-programs"
import { LoyaltyRewardsService } from "@modules/domain/loyalty-rewards"
import type { LoyaltyReward } from "@modules/domain/loyalty-rewards"
import { CLOCK } from "@modules/platform/clock"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { LoyaltyErrorCode } from "./errors/loyalty.error"
import { LoyaltyPublicService } from "./loyalty-public.service"
import { LOYALTY_CODE_DELIVERY } from "./loyalty.decorators"
import type { CodeDelivery } from "./loyalty.contracts"

const NOW = Date.UTC(2026, 9, 12)
const programOf = builder<LoyaltyProgram>({
    workspaceId: "ws-1",
    slug: "spa",
    name: "Spa Anna",
    enabled: true,
    createdAt: "2026-10-01T00:00:00.000Z",
    config: {
        earn: { perThousandVnd: 1, perVisit: 0, categories: [], trigger: "payment", minOrderVnd: 0 },
        tiers: [
            { key: "dong", name: "Bronze", minSpendVnd: 0, multiplier: 1, winbackDays: 60, benefit: "" },
            { key: "bac", name: "Silver", minSpendVnd: 3_000_000, multiplier: 1.2, winbackDays: 45, benefit: "" },
        ],
        expiry: { months: 12, warnDays: 30 },
        birthday: { enabled: true, points: 100, rewardKey: "", note: "" },
        promo: { maxPerMonth: 4, hourFrom: "08:00", hourTo: "21:00", batch: 20 },
    },
})
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
    lifetimeSpendVnd: 1_000_000,
    visits: 1,
    lastVisitAt: null,
    joinedAt: "x",
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
    note: "n",
    active: true,
})
const catalog = mock<MessageCatalog>({ get: (key, params) => `${key}|${String(params.shop)}|${String(params.code)}` })

interface Options {
    program?: LoyaltyProgram | null
    customer?: typeof CUSTOMER | null
    workspaceCodes?: number
    customerCodes?: number
    target?: { id: string; channel: string | null } | null
    delivered?: boolean
    check?: "accepted" | "rejected"
    member?: LoyaltyMember | null
}

const build = async (options: Options = {}) => {
    const programs = mock<LoyaltyProgramsService>()
    programs.findBySlug.mockResolvedValue(options.program === undefined ? programOf() : options.program)
    programs.shopName.mockResolvedValue("Spa Anna")
    const customers = mock<LoyaltyCustomersService>()
    customers.byPhone.mockResolvedValue(options.customer === undefined ? CUSTOMER : options.customer)
    const links = mock<LoyaltyCustomerLinksService>()
    links.pushConversation.mockResolvedValue(
        options.target === undefined ? { id: "v1", channel: "telegram" } : options.target,
    )
    const otps = mock<LoyaltyOtpsService>()
    otps.workspaceCodesSince.mockResolvedValue(options.workspaceCodes ?? 0)
    otps.customerCodesSince.mockResolvedValue(options.customerCodes ?? 0)
    otps.issue.mockResolvedValue({ id: "o1", code: "123456" })
    otps.discard.mockResolvedValue(undefined)
    otps.check.mockResolvedValue(options.check ?? "accepted")
    const ledger = mock<LoyaltyLedgerService>()
    ledger.member.mockResolvedValue(options.member === undefined ? memberOf() : options.member)
    ledger.redeemedCounts.mockResolvedValue(new Map())
    ledger.expiryEntries.mockResolvedValue([])
    const rewards = mock<LoyaltyRewardsService>()
    rewards.list.mockResolvedValue([rewardOf(), rewardOf({ id: "r2", pointsCost: 5000 })])
    const delivery = mock<CodeDelivery>({ send: jest.fn().mockResolvedValue(options.delivered ?? true) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            LoyaltyPublicService,
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: LOYALTY_CODE_DELIVERY, useValue: delivery },
            { provide: LoyaltyProgramsService, useValue: programs },
            { provide: LoyaltyCustomersService, useValue: customers },
            { provide: LoyaltyCustomerLinksService, useValue: links },
            { provide: LoyaltyOtpsService, useValue: otps },
            { provide: LoyaltyLedgerService, useValue: ledger },
            { provide: LoyaltyRewardsService, useValue: rewards },
        ],
    }).compile()
    return { service: moduleRef.get(LoyaltyPublicService), otps, delivery }
}

describe("LoyaltyPublicService", () => {
    describe("page", () => {
        it("shows the name of the programme, or of the shop when the programme has none", async () => {
            const named = await build()
            const unnamed = await build({ program: programOf({ name: "" }) })

            await expect(named.service.page({ slug: "spa" })).resolves.toEqual({
                slug: "spa",
                shop: "Spa Anna",
                name: "Spa Anna",
            })
            await expect(unnamed.service.page({ slug: "spa" })).resolves.toEqual({
                slug: "spa",
                shop: "Spa Anna",
                name: "",
            })
        })

        it("refuses a slug no switched-on programme has", async () => {
            const { service } = await build({ program: null })

            await expect(service.page({ slug: "nobody" })).rejects.toMatchObject({
                code: LoyaltyErrorCode.PageNotFound,
            })
        })
    })

    describe("requestCode", () => {
        const request = { slug: "spa", phone: "0912 345 678" }

        it("sends a fresh code to the chat of the customer and answers the same as always", async () => {
            const { service, otps, delivery } = await build()

            await expect(service.requestCode(request)).resolves.toEqual({ ok: true, code: "none" })

            expect(otps.issue).toHaveBeenCalledWith("ws-1", "c1", new Date(NOW + 600_000).toISOString())
            expect(delivery.send).toHaveBeenCalledWith({
                workspaceId: "ws-1",
                conversationId: "v1",
                text: "loyalty.otp.message|Spa Anna|123456",
            })
            expect(otps.discard).not.toHaveBeenCalled()
        })

        it("drops a code the channel did not accept", async () => {
            const { service, otps } = await build({ delivered: false })

            await expect(service.requestCode(request)).resolves.toEqual({ ok: true, code: "none" })
            expect(otps.discard).toHaveBeenCalledWith("o1")
        })

        it("answers the same and sends nothing for a phone that is no customer, a customer asked too often or a customer without a push chat", async () => {
            const stranger = await build({ customer: null })
            const often = await build({ customerCodes: 3 })
            const none = await build({ target: null })
            const noChannel = await build({ target: { id: "v1", channel: null } })
            const website = await build({ target: { id: "v1", channel: "website" } })

            for (const world of [stranger, often, none, noChannel, website]) {
                await expect(world.service.requestCode(request)).resolves.toEqual({ ok: true, code: "none" })
                expect(world.delivery.send).not.toHaveBeenCalled()
            }
        })

        it("refuses a phone that is not a number, a page that is gone and a busy workspace", async () => {
            const { service } = await build()
            const gone = await build({ program: null })
            const busy = await build({ workspaceCodes: 30 })

            await expect(service.requestCode({ slug: "spa", phone: "12" })).resolves.toEqual({
                ok: false,
                code: "bad_phone",
            })
            await expect(gone.service.requestCode(request)).resolves.toEqual({ ok: false, code: "closed" })
            await expect(busy.service.requestCode(request)).resolves.toEqual({ ok: false, code: "busy" })
        })
    })

    describe("verifyCode", () => {
        const verify = { slug: "spa", phone: "0912 345 678", typed: "123 456" }

        it("shows the points, the tier progress and the rewards the customer can redeem", async () => {
            const { service } = await build()

            const answer = await service.verifyCode(verify)

            expect(answer.ok).toBe(true)
            expect(answer.points).toMatchObject({
                shop: "Spa Anna",
                name: "Mai",
                tierName: "Bronze",
                points: 600,
                nextTier: { missingVnd: 2_000_000 },
                expiring: { points: 0, firstAt: null },
            })
            expect(answer.points?.rewards).toEqual([
                { name: "Voucher", pointsCost: 500, note: "n", canRedeem: true },
                { name: "Voucher", pointsCost: 5000, note: "n", canRedeem: false },
            ])
        })

        it("shows no expiry warning for a programme whose points never expire", async () => {
            const program = programOf()
            const never = programOf({ config: { ...program.config, expiry: { months: 0, warnDays: 30 } } })
            const { service } = await build({ program: never, member: memberOf({ tierKey: null }) })

            const answer = await service.verifyCode(verify)

            expect(answer.points).toMatchObject({ expiring: { points: 0, firstAt: null }, tierName: "" })
        })

        it("refuses a code that is not six digits, a phone that is not a number and a code that is wrong", async () => {
            const { service } = await build()
            const wrong = await build({ check: "rejected" })

            await expect(service.verifyCode({ ...verify, typed: "12345" })).resolves.toEqual({
                ok: false,
                code: "wrong",
                points: null,
            })
            await expect(service.verifyCode({ ...verify, phone: "12" })).resolves.toEqual({
                ok: false,
                code: "wrong",
                points: null,
            })
            await expect(wrong.service.verifyCode(verify)).resolves.toEqual({ ok: false, code: "wrong", points: null })
        })

        it("refuses a page that is gone, a phone that is no customer and a customer who vanished", async () => {
            const gone = await build({ program: null })
            const stranger = await build({ customer: null })
            const vanished = await build({ member: null })

            await expect(gone.service.verifyCode(verify)).resolves.toEqual({ ok: false, code: "closed", points: null })
            await expect(stranger.service.verifyCode(verify)).resolves.toEqual({
                ok: false,
                code: "wrong",
                points: null,
            })
            await expect(vanished.service.verifyCode(verify)).resolves.toEqual({
                ok: false,
                code: "wrong",
                points: null,
            })
        })
    })
})
