import { Test } from "@nestjs/testing"
import { FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { BillingService } from "@modules/domain/billing"
import type { PayableOrder, Plan, WorkspaceBilling } from "@modules/domain/billing"
import { PaymentOrdersService } from "@modules/domain/payment-orders"
import type { PaymentOrder } from "@modules/domain/payment-orders"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { CreditsService } from "./credits.service"
import { CreditsError, CreditsErrorCode } from "./errors/credits.error"
import { SELECT_ACTIVE_PACKS, SELECT_MONTH_PACK_PURCHASES, SELECT_TOPUP_LOTS } from "./persistence/credits.sql"

const NOW = "2026-10-12T10:00:00.000Z"
const PAID_UNTIL = "2026-10-27T10:00:00.000Z"
const PACK_ROW = { code: "credits_1000", credits: 1000, price_vnd: 299000, sort: 2 }
const CURRENT: Plan = {
    code: "starter",
    nameVi: "Khoi dau",
    nameEn: "Starter",
    priceVnd: 990000,
    period: "month",
    seats: 3,
    features: { vi: ["a"], en: ["b"] },
    sort: 1,
    aiCreditsPerMonth: 3000,
    isCustom: false,
    priceAnnualVnd: null,
    annualDiscountPct: null,
    promoPriceVnd: null,
    promoMonths: null,
    storageGb: null,
    individual: false,
    perSeat: false,
    listed: false,
    tiers: [],
    packs: [],
}
const TARGET: Plan = { ...CURRENT, code: "growth", priceVnd: 1990000, sort: 2, listed: true }
const WORKSPACE: WorkspaceBilling = {
    status: "active",
    planCode: "starter",
    paidUntil: PAID_UNTIL,
    tierCredits: null,
    seatCount: null,
    billingCycle: null,
    billedMonthlyVnd: null,
}
const ORDER: PaymentOrder = {
    id: "order-1",
    workspaceId: "ws-1",
    planCode: "starter",
    amountVnd: 299000,
    orderCode: "NIVO8F3K2",
    status: "pending",
    expiresAt: "2026-10-12T10:30:00.000Z",
    paidAt: null,
    createdAt: NOW,
    kind: "topup",
    packCode: "credits_1000",
    detail: { credits: 1000 },
}
const PAYABLE: PayableOrder = {
    order: ORDER,
    qrUrl: "https://qr.sepay.vn/img?acc=0123&bank=MB&amount=299000&des=NIVO8F3K2&template=compact",
    bank: { account: "0123", bank: "MB", holder: "NIVO" },
}
const UPGRADE_ORDER: PaymentOrder = {
    ...ORDER,
    planCode: "growth",
    amountVnd: 1495000,
    kind: "upgrade",
    packCode: null,
    detail: {
        from: "starter",
        to: "growth",
        fromPrice: 990000,
        toPrice: 1990000,
        credit: 495000,
        daysLeft: 15,
        paidUntil: PAID_UNTIL,
    },
}
const UPGRADE_PAYABLE: PayableOrder = {
    ...PAYABLE,
    order: UPGRADE_ORDER,
    qrUrl: "https://qr.sepay.vn/img?acc=0123&bank=MB&amount=1495000&des=NIVO8F3K2&template=compact",
}
const UPGRADE_RESULT = {
    payable: UPGRADE_PAYABLE,
    quote: { amount: 1495000, credit: 495000, daysLeft: 15, fromCode: "starter" },
}
const TOPUP = { workspaceId: "ws-1", packCode: "credits_1000" }
const UPGRADE = { workspaceId: "ws-1", planCode: "growth" }

const build = async (
    entityManager: MockEntityManager = mockEntityManager({ query: [SELECT_ACTIVE_PACKS, [PACK_ROW]] }),
) => {
    const billing = mock<BillingService>()
    billing.requireManager.mockResolvedValue(undefined)
    billing.findWorkspaceBilling.mockResolvedValue(WORKSPACE)
    billing.findPlan.mockImplementation((code) => Promise.resolve(code === "starter" ? CURRENT : TARGET))
    billing.payable.mockReturnValue(PAYABLE)
    const orders = mock<PaymentOrdersService>()
    orders.findOpenTopup.mockResolvedValue(null)
    orders.findOpenUpgrade.mockResolvedValue(null)
    orders.findOpenCreditPack.mockResolvedValue(null)
    orders.create.mockResolvedValue(ORDER)
    const moduleRef = await Test.createTestingModule({
        providers: [
            CreditsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: BillingService, useValue: billing },
            { provide: PaymentOrdersService, useValue: orders },
        ],
    }).compile()
    return { credits: moduleRef.get(CreditsService), billing, orders }
}

describe("CreditsService", () => {
    it("lists every active pack in the database display order", async () => {
        const em = mockEntityManager({
            query: [
                SELECT_ACTIVE_PACKS,
                [PACK_ROW, { code: "credits_5000", credits: 5000, price_vnd: 999000, sort: 3 }],
            ],
        })
        const { credits } = await build(em)

        await expect(credits.listPacks()).resolves.toEqual([
            { code: "credits_1000", credits: 1000, priceVnd: 299000, sort: 2 },
            { code: "credits_5000", credits: 5000, priceVnd: 999000, sort: 3 },
        ])
        expect(em.query).toHaveBeenCalledWith(SELECT_ACTIVE_PACKS)
    })

    it("answers an empty catalogue when there are no active packs", async () => {
        const { credits } = await build(mockEntityManager({ query: [SELECT_ACTIVE_PACKS, []] }))

        await expect(credits.listPacks()).resolves.toEqual([])
    })

    describe("topup", () => {
        it.each(["active", "past_due"])(
            "creates a pack order for an %s workspace from catalogue values",
            async (status) => {
                const { credits, billing, orders } = await build()
                billing.findWorkspaceBilling.mockResolvedValue({ ...WORKSPACE, status })

                await expect(credits.topup("person-1", TOPUP)).resolves.toEqual(PAYABLE)
                expect(billing.requireManager).toHaveBeenCalledWith("person-1", "ws-1")
                expect(billing.findWorkspaceBilling).toHaveBeenCalledWith("ws-1")
                expect(billing.findPlan).toHaveBeenCalledWith("starter")
                expect(orders.findOpenTopup).toHaveBeenCalledWith({
                    workspaceId: "ws-1",
                    target: "credits_1000",
                    amountVnd: 299000,
                })
                expect(orders.create).toHaveBeenCalledWith({
                    workspaceId: "ws-1",
                    userId: "person-1",
                    planCode: "starter",
                    amountVnd: 299000,
                    kind: "topup",
                    packCode: "credits_1000",
                    detail: { credits: 1000 },
                })
                expect(billing.payable).toHaveBeenCalledWith(ORDER)
            },
        )

        it("answers the existing payable top-up instead of creating another order", async () => {
            const { credits, billing, orders } = await build()
            orders.findOpenTopup.mockResolvedValue(ORDER)

            await expect(credits.topup("person-1", TOPUP)).resolves.toEqual(PAYABLE)
            expect(billing.payable).toHaveBeenCalledWith(ORDER)
            expect(orders.create).not.toHaveBeenCalled()
        })

        it("refuses an unknown pack before reading workspace billing", async () => {
            const { credits, billing, orders } = await build()

            await expect(credits.topup("person-1", { ...TOPUP, packCode: "unknown" })).rejects.toEqual(
                new CreditsError({ code: CreditsErrorCode.PackNotFound }),
            )
            expect(billing.findWorkspaceBilling).not.toHaveBeenCalled()
            expect(orders.create).not.toHaveBeenCalled()
        })

        it.each([null, { ...WORKSPACE, planCode: null }, { ...WORKSPACE, status: "pending_payment" }])(
            "refuses a workspace outside the allowed billing state: %p",
            async (workspace) => {
                const { credits, billing, orders } = await build()
                billing.findWorkspaceBilling.mockResolvedValue(workspace)

                await expect(credits.topup("person-1", TOPUP)).rejects.toEqual(
                    new CreditsError({ code: CreditsErrorCode.WorkspaceNotActive }),
                )
                expect(billing.findPlan).not.toHaveBeenCalled()
                expect(orders.create).not.toHaveBeenCalled()
            },
        )

        it("refuses a current plan that is no longer in the catalogue", async () => {
            const { credits, billing, orders } = await build()
            billing.findPlan.mockResolvedValue(null)

            await expect(credits.topup("person-1", TOPUP)).rejects.toEqual(
                new CreditsError({ code: CreditsErrorCode.PlanNotFound }),
            )
            expect(orders.create).not.toHaveBeenCalled()
        })

        it("refuses a listed plan, which buys add-on packs instead of the old catalogue", async () => {
            const { credits, billing, orders } = await build()
            billing.findPlan.mockResolvedValue({ ...CURRENT, listed: true })

            await expect(credits.topup("person-1", TOPUP)).rejects.toEqual(
                new CreditsError({ code: CreditsErrorCode.UsePacks }),
            )
            expect(orders.findOpenTopup).not.toHaveBeenCalled()
            expect(orders.create).not.toHaveBeenCalled()
        })

        it("propagates the manager refusal before reading the catalogue", async () => {
            const em = mockEntityManager()
            const { credits, billing, orders } = await build(em)
            const forbidden = new Error("manager required")
            billing.requireManager.mockRejectedValue(forbidden)

            await expect(credits.topup("person-1", TOPUP)).rejects.toBe(forbidden)
            expect(em.query).not.toHaveBeenCalled()
            expect(orders.create).not.toHaveBeenCalled()
        })
    })

    describe("upgrade", () => {
        it("freezes the unused credit and current billing figures on a new upgrade order", async () => {
            const { credits, billing, orders } = await build()
            billing.payable.mockReturnValue(UPGRADE_PAYABLE)
            orders.create.mockResolvedValue(UPGRADE_ORDER)

            await expect(credits.upgrade("person-1", UPGRADE)).resolves.toEqual(UPGRADE_RESULT)
            expect(billing.requireManager).toHaveBeenCalledWith("person-1", "ws-1")
            expect(billing.findPlan.mock.calls).toEqual([["starter"], ["growth"]])
            expect(orders.findOpenUpgrade).toHaveBeenCalledWith({
                workspaceId: "ws-1",
                target: "growth",
                amountVnd: 1495000,
            })
            expect(orders.create).toHaveBeenCalledWith({
                workspaceId: "ws-1",
                userId: "person-1",
                planCode: "growth",
                amountVnd: 1495000,
                kind: "upgrade",
                packCode: null,
                detail: {
                    from: "starter",
                    to: "growth",
                    fromPrice: 990000,
                    toPrice: 1990000,
                    credit: 495000,
                    daysLeft: 15,
                    paidUntil: PAID_UNTIL,
                },
            })
            expect(billing.payable).toHaveBeenCalledWith(UPGRADE_ORDER)
        })

        it("answers the existing order and today's exact quote", async () => {
            const { credits, billing, orders } = await build()
            orders.findOpenUpgrade.mockResolvedValue(UPGRADE_ORDER)
            billing.payable.mockReturnValue(UPGRADE_PAYABLE)

            await expect(credits.upgrade("person-1", UPGRADE)).resolves.toEqual(UPGRADE_RESULT)
            expect(billing.payable).toHaveBeenCalledWith(UPGRADE_ORDER)
            expect(orders.create).not.toHaveBeenCalled()
        })

        it.each([
            { current: CURRENT, target: null, reads: 1 },
            { current: { ...CURRENT, isCustom: true }, target: TARGET, reads: 1 },
            { current: CURRENT, target: { ...TARGET, isCustom: true }, reads: 1 },
            { current: CURRENT, target: { ...TARGET, listed: false }, reads: 1 },
            { current: CURRENT, target: { ...TARGET, perSeat: true }, reads: 1 },
            { current: CURRENT, target: { ...TARGET, sort: 0 }, reads: 2 },
            { current: CURRENT, target: { ...TARGET, sort: 1 }, reads: 2 },
            { current: CURRENT, target: { ...TARGET, priceVnd: 989000 }, reads: 2 },
            { current: CURRENT, target: { ...TARGET, priceVnd: 990000 }, reads: 2 },
        ])("refuses a target that is not a higher self-serve plan: %p", async ({ current, target, reads }) => {
            const { credits, billing, orders } = await build()
            billing.findPlan.mockResolvedValueOnce(current).mockResolvedValueOnce(target)

            await expect(credits.upgrade("person-1", UPGRADE)).rejects.toEqual(
                new CreditsError({ code: CreditsErrorCode.NotUpgrade }),
            )
            expect(billing.findWorkspaceBilling).toHaveBeenCalledTimes(reads)
            expect(orders.findOpenUpgrade).not.toHaveBeenCalled()
            expect(orders.create).not.toHaveBeenCalled()
        })

        it("prices the upgrade from the monthly amount the workspace was billed, not the catalogue", async () => {
            const { credits, billing, orders } = await build()
            billing.findWorkspaceBilling.mockResolvedValue({ ...WORKSPACE, billedMonthlyVnd: 1200000 })
            billing.payable.mockReturnValue(UPGRADE_PAYABLE)
            orders.create.mockResolvedValue(UPGRADE_ORDER)

            await expect(credits.upgrade("person-1", UPGRADE)).resolves.toEqual({
                payable: UPGRADE_PAYABLE,
                quote: { amount: 1390000, credit: 600000, daysLeft: 15, fromCode: "starter" },
            })
            expect(orders.create).toHaveBeenCalledWith({
                workspaceId: "ws-1",
                userId: "person-1",
                planCode: "growth",
                amountVnd: 1390000,
                kind: "upgrade",
                packCode: null,
                detail: {
                    from: "starter",
                    to: "growth",
                    fromPrice: 1200000,
                    toPrice: 1990000,
                    credit: 600000,
                    daysLeft: 15,
                    paidUntil: PAID_UNTIL,
                },
            })
        })

        it("refuses an upgrade that does not beat the monthly amount already billed", async () => {
            const { credits, billing, orders } = await build()
            billing.findWorkspaceBilling.mockResolvedValue({ ...WORKSPACE, billedMonthlyVnd: 1990000 })

            await expect(credits.upgrade("person-1", UPGRADE)).rejects.toEqual(
                new CreditsError({ code: CreditsErrorCode.NotUpgrade }),
            )
            expect(billing.findWorkspaceBilling).toHaveBeenCalledTimes(2)
            expect(orders.create).not.toHaveBeenCalled()
        })

        it.each([
            null,
            { ...WORKSPACE, paidUntil: null },
            { ...WORKSPACE, paidUntil: NOW },
            { ...WORKSPACE, paidUntil: "2026-10-11T10:00:00.000Z" },
        ])("requires renewal when the latest paid period is unavailable or over: %p", async (workspace) => {
            const { credits, billing, orders } = await build()
            billing.findWorkspaceBilling.mockResolvedValueOnce(WORKSPACE).mockResolvedValueOnce(workspace)

            await expect(credits.upgrade("person-1", UPGRADE)).rejects.toEqual(
                new CreditsError({ code: CreditsErrorCode.RenewFirst }),
            )
            expect(orders.findOpenUpgrade).not.toHaveBeenCalled()
            expect(orders.create).not.toHaveBeenCalled()
        })

        it("requires an active workspace even when a past-due workspace can buy a top-up", async () => {
            const { credits, billing, orders } = await build()
            billing.findWorkspaceBilling.mockResolvedValue({ ...WORKSPACE, status: "past_due" })

            await expect(credits.upgrade("person-1", UPGRADE)).rejects.toEqual(
                new CreditsError({ code: CreditsErrorCode.WorkspaceNotActive }),
            )
            expect(billing.findPlan).not.toHaveBeenCalled()
            expect(orders.create).not.toHaveBeenCalled()
        })

        it("refuses an upgrade whose prepaid credit covers the whole target price", async () => {
            const { credits, billing, orders } = await build()
            billing.findWorkspaceBilling.mockResolvedValue({ ...WORKSPACE, paidUntil: "2026-12-12T10:00:00.000Z" })

            await expect(credits.upgrade("person-1", UPGRADE)).rejects.toEqual(
                new CreditsError({ code: CreditsErrorCode.ZeroAmount }),
            )
            expect(orders.findOpenUpgrade).not.toHaveBeenCalled()
            expect(orders.create).not.toHaveBeenCalled()
        })
    })

    describe("topupLots", () => {
        const row = {
            credits: 1000,
            price_vnd: 299000,
            purchased_at: NOW,
            expires_at: PAID_UNTIL,
            credits_remaining: 800,
        }

        it("lists the purchased lots for a manager", async () => {
            const em = mockEntityManager({ query: [SELECT_TOPUP_LOTS, [row]] })
            const { credits, billing } = await build(em)

            await expect(credits.topupLots("person-1", "ws-1")).resolves.toEqual([
                {
                    credits: 1000,
                    priceVnd: 299000,
                    purchasedAt: NOW,
                    expiresAt: PAID_UNTIL,
                    creditsRemaining: 800,
                },
            ])
            expect(billing.requireManager).toHaveBeenCalledWith("person-1", "ws-1")
            expect(em.query).toHaveBeenCalledWith(SELECT_TOPUP_LOTS, ["ws-1"])
        })
    })

    describe("packsBought", () => {
        it("lists the add-on packs paid this month for a member", async () => {
            const em = mockEntityManager({
                query: [SELECT_MONTH_PACK_PURCHASES, [{ credits: 1000, price_vnd: 299000, purchased_at: NOW }]],
            })
            const { credits, billing } = await build(em)

            await expect(credits.packsBought("person-1", "ws-1")).resolves.toEqual([
                { credits: 1000, priceVnd: 299000, purchasedAt: NOW },
            ])
            expect(billing.requireMember).toHaveBeenCalledWith("person-1", "ws-1")
            expect(em.query).toHaveBeenCalledWith(SELECT_MONTH_PACK_PURCHASES, ["ws-1"])
        })
    })

    describe("creditPack", () => {
        const PACK_PLAN: Plan = {
            ...CURRENT,
            listed: true,
            packs: [{ creditsPerMonth: 1000, priceVnd: 299000, perSeat: false }],
        }
        const ASK = { workspaceId: "ws-1", credits: 1000 }

        it("orders the add-on pack listed on the workspace plan", async () => {
            const { credits, billing, orders } = await build()
            billing.findPlan.mockResolvedValue(PACK_PLAN)

            await expect(credits.creditPack("person-1", ASK)).resolves.toEqual(PAYABLE)
            expect(orders.findOpenCreditPack).toHaveBeenCalledWith({
                workspaceId: "ws-1",
                target: "1000",
                amountVnd: 299000,
            })
            expect(orders.create).toHaveBeenCalledWith({
                workspaceId: "ws-1",
                userId: "person-1",
                planCode: "starter",
                amountVnd: 299000,
                kind: "credit_pack",
                packCode: null,
                detail: { credits: 1000 },
            })
            expect(billing.payable).toHaveBeenCalledWith(ORDER)
        })

        it("answers the existing open pack order", async () => {
            const { credits, billing, orders } = await build()
            billing.findPlan.mockResolvedValue(PACK_PLAN)
            orders.findOpenCreditPack.mockResolvedValue(ORDER)

            await expect(credits.creditPack("person-1", ASK)).resolves.toEqual(PAYABLE)
            expect(billing.payable).toHaveBeenCalledWith(ORDER)
            expect(orders.create).not.toHaveBeenCalled()
        })

        it("refuses a pack size the plan does not sell", async () => {
            const { credits, billing, orders } = await build()
            billing.findPlan.mockResolvedValue(PACK_PLAN)

            await expect(credits.creditPack("person-1", { ...ASK, credits: 50 })).rejects.toEqual(
                new CreditsError({ code: CreditsErrorCode.PackNotFound }),
            )
            expect(orders.create).not.toHaveBeenCalled()
        })
    })
})
