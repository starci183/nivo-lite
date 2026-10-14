import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PaymentOrdersService } from "@modules/domain/payment-orders"
import type { PaymentOrder } from "@modules/domain/payment-orders"
import { Secret } from "@modules/platform/config"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { BILLING_OPTIONS } from "./billing.decorators"
import type { BillingOptions } from "./billing.options"
import { BillingService } from "./billing.service"
import { BillingErrorCode } from "./errors/billing.error"
import {
    SELECT_ACTIVE_PLANS,
    SELECT_BILLING_WORKSPACE,
    SELECT_BILLING_WORKSPACES,
    SELECT_MEMBER_ROLE,
    SELECT_PLAN,
    SELECT_PLAN_TIERS,
    SELECT_PROMO_HISTORY,
    SELECT_WORKSPACE_BILLING,
} from "./persistence/billing.sql"

const OPTIONS: BillingOptions = {
    sepayApiKey: new Secret("key"),
    bankAccount: { account: "0123", bank: "MB", holder: "NIVO" },
    simulatedBank: { secret: undefined, workspaceId: undefined },
    channelTokenKey: undefined,
}
const PLAN_ROW = {
    code: "starter",
    name_vi: "Khoi dau",
    name_en: "Starter",
    price_vnd: 990000,
    period: "month",
    seats: 3,
    features: { vi: ["a"], en: ["b"] },
    sort: 1,
    ai_credits_per_month: 3000,
    is_custom: false,
    price_annual_vnd: null,
    annual_discount_pct: null,
    promo_price_vnd: null,
    promo_months: null,
    storage_gb: null,
    individual: false,
    per_seat: false,
    listed: true,
}
const ORDER: PaymentOrder = {
    id: "order-1",
    workspaceId: "ws-1",
    planCode: "starter",
    amountVnd: 990000,
    orderCode: "NIVO8F3K2",
    status: "pending",
    expiresAt: "2026-10-12T10:30:00.000Z",
    paidAt: null,
    createdAt: "2026-10-12T10:00:00.000Z",
    kind: "plan",
    packCode: null,
    detail: {},
}
const PAYABLE = {
    order: ORDER,
    qrUrl: "https://qr.sepay.vn/img?acc=0123&bank=MB&amount=990000&des=NIVO8F3K2&template=compact",
    bank: OPTIONS.bankAccount,
}
const PLAN_DETAIL = {
    cycle: "monthly",
    months: 1,
    tierCredits: 0,
    seats: 1,
    promo: false,
    listMonthlyVnd: 990000,
}
const NO_TIER = { tier_credits: null, seat_count: null, billing_cycle: null, billed_monthly_vnd: null }
const WORKSPACE_ROW = { status: "active", plan_code: "starter", paid_until: null, ...NO_TIER }

const build = async (entityManager: MockEntityManager) => {
    const orders = mock<PaymentOrdersService>()
    orders.create.mockResolvedValue(ORDER)
    const moduleRef = await Test.createTestingModule({
        providers: [
            BillingService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: PaymentOrdersService, useValue: orders },
            { provide: BILLING_OPTIONS, useValue: OPTIONS },
        ],
    }).compile()
    return { billing: moduleRef.get(BillingService), orders }
}

describe("BillingService", () => {
    it("answers the configured bank account", async () => {
        const { billing } = await build(mockEntityManager())

        await expect(billing.bankAccount()).resolves.toEqual(OPTIONS.bankAccount)
    })

    it("lists the active plans", async () => {
        const { billing } = await build(
            mockEntityManager({
                query: [
                    [SELECT_ACTIVE_PLANS, [PLAN_ROW]],
                    [SELECT_PLAN_TIERS, []],
                ],
            }),
        )

        await expect(billing.listPlans()).resolves.toMatchObject([{ code: "starter", priceVnd: 990000, listed: true }])
    })

    it("finds a plan, answers null for an unknown code and refuses to require it", async () => {
        const { billing } = await build(
            mockEntityManager({
                query: [
                    [SELECT_PLAN, [PLAN_ROW]],
                    [SELECT_PLAN_TIERS, []],
                ],
            }),
        )
        const { billing: none } = await build(mockEntityManager({ query: [SELECT_PLAN, []] }))

        await expect(billing.findPlan("starter")).resolves.toMatchObject({ code: "starter" })
        await expect(billing.requirePlan("starter")).resolves.toMatchObject({ code: "starter" })
        await expect(none.findPlan("nope")).resolves.toBeNull()
        await expect(none.requirePlan("nope")).rejects.toMatchObject({
            code: BillingErrorCode.PlanNotFound,
            params: { plan: "nope" },
        })
    })

    it("reads the billing columns of a workspace or null", async () => {
        const row = {
            ...WORKSPACE_ROW,
            tier_credits: 3000,
            seat_count: 2,
            billing_cycle: "monthly",
            billed_monthly_vnd: 990000,
        }
        const { billing } = await build(mockEntityManager({ query: [SELECT_WORKSPACE_BILLING, [row]] }))
        const { billing: none } = await build(mockEntityManager({ query: [SELECT_WORKSPACE_BILLING, []] }))

        await expect(billing.findWorkspaceBilling("ws-1")).resolves.toEqual({
            status: "active",
            planCode: "starter",
            paidUntil: null,
            tierCredits: 3000,
            seatCount: 2,
            billingCycle: "monthly",
            billedMonthlyVnd: 990000,
        })
        await expect(none.findWorkspaceBilling("ws-1")).resolves.toBeNull()
    })

    describe("membership", () => {
        it.each(["owner", "manager"])("lets an active %s manage and be a member", async (role) => {
            const em = mockEntityManager({ query: [SELECT_MEMBER_ROLE, [{ role }]] })
            const { billing } = await build(em)

            await expect(billing.requireManager("person-1", "ws-1")).resolves.toBeUndefined()
            await expect(billing.requireMember("person-1", "ws-1")).resolves.toBeUndefined()
            expect(em.query).toHaveBeenCalledWith(SELECT_MEMBER_ROLE, ["ws-1", "person-1"])
        })

        it("lets staff read but not manage", async () => {
            const { billing } = await build(mockEntityManager({ query: [SELECT_MEMBER_ROLE, [{ role: "staff" }]] }))

            await expect(billing.requireMember("person-1", "ws-1")).resolves.toBeUndefined()
            await expect(billing.requireManager("person-1", "ws-1")).rejects.toMatchObject({
                code: BillingErrorCode.Forbidden,
            })
        })

        it("refuses a person who is not a member", async () => {
            const { billing } = await build(mockEntityManager({ query: [SELECT_MEMBER_ROLE, []] }))

            await expect(billing.requireMember("person-1", "ws-1")).rejects.toMatchObject({
                code: BillingErrorCode.NotMember,
            })
            await expect(billing.requireManager("person-1", "ws-1")).rejects.toMatchObject({
                code: BillingErrorCode.Forbidden,
            })
        })
    })

    describe("renew", () => {
        const WORKSPACE = [WORKSPACE_ROW]
        const priced = (plan: typeof PLAN_ROW = PLAN_ROW) => [
            [SELECT_MEMBER_ROLE, [{ role: "owner" }]],
            [SELECT_WORKSPACE_BILLING, WORKSPACE],
            [SELECT_PLAN, [plan]],
            [SELECT_PLAN_TIERS, []],
            [SELECT_PROMO_HISTORY, []],
        ]

        it("orders the current plan of the workspace at its price", async () => {
            const { billing, orders } = await build(mockEntityManager({ query: priced() }))

            await expect(billing.renew("person-1", { workspaceId: "ws-1" })).resolves.toEqual(PAYABLE)
            expect(orders.create).toHaveBeenCalledWith({
                workspaceId: "ws-1",
                userId: "person-1",
                planCode: "starter",
                amountVnd: 990000,
                kind: "plan",
                packCode: null,
                detail: PLAN_DETAIL,
            })
        })

        it("keeps the cycle and the seats the workspace already pays", async () => {
            const { billing, orders } = await build(
                mockEntityManager({
                    query: [
                        [SELECT_MEMBER_ROLE, [{ role: "owner" }]],
                        [SELECT_WORKSPACE_BILLING, [{ ...WORKSPACE_ROW, seat_count: 4, billing_cycle: "annual" }]],
                        [SELECT_PLAN, [{ ...PLAN_ROW, price_annual_vnd: 9900000, annual_discount_pct: 17 }]],
                        [SELECT_PLAN_TIERS, []],
                        [SELECT_PROMO_HISTORY, []],
                    ],
                }),
            )

            await expect(billing.renew("person-1", { workspaceId: "ws-1" })).resolves.toEqual(PAYABLE)
            expect(orders.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    amountVnd: 9900000,
                    detail: { ...PLAN_DETAIL, cycle: "annual", months: 12 },
                }),
            )
        })

        it("refuses a workspace that does not exist or has no plan yet", async () => {
            const missing = await build(
                mockEntityManager({
                    query: [
                        [SELECT_MEMBER_ROLE, [{ role: "owner" }]],
                        [SELECT_WORKSPACE_BILLING, []],
                        [SELECT_PLAN, []],
                    ],
                }),
            )
            const unpaid = await build(
                mockEntityManager({
                    query: [
                        [SELECT_MEMBER_ROLE, [{ role: "owner" }]],
                        [SELECT_WORKSPACE_BILLING, [{ status: "pending_payment", plan_code: null, paid_until: null }]],
                        [SELECT_PLAN, []],
                    ],
                }),
            )

            await expect(missing.billing.renew("person-1", { workspaceId: "ws-1" })).rejects.toMatchObject({
                code: BillingErrorCode.WorkspaceNotFound,
            })
            await expect(unpaid.billing.renew("person-1", { workspaceId: "ws-1" })).rejects.toMatchObject({
                code: BillingErrorCode.WorkspaceNotFound,
            })
        })

        it("refuses a contract plan and writes no order", async () => {
            const { billing, orders } = await build(
                mockEntityManager({ query: priced({ ...PLAN_ROW, is_custom: true }) }),
            )

            await expect(billing.renew("person-1", { workspaceId: "ws-1" })).rejects.toMatchObject({
                code: BillingErrorCode.PlanCustom,
            })
            expect(orders.create).not.toHaveBeenCalled()
        })

        it("refuses a caller who is not a manager before reading anything else", async () => {
            const em = mockEntityManager({ query: [SELECT_MEMBER_ROLE, []] })
            const { billing } = await build(em)

            await expect(billing.renew("person-1", { workspaceId: "ws-1" })).rejects.toMatchObject({
                code: BillingErrorCode.Forbidden,
            })
            expect(em.query).toHaveBeenCalledTimes(1)
        })
    })

    describe("orderPlan", () => {
        it("orders the plan the workspace chose", async () => {
            const em = mockEntityManager({
                query: [
                    [SELECT_MEMBER_ROLE, [{ role: "manager" }]],
                    [SELECT_PLAN, [PLAN_ROW]],
                    [SELECT_PLAN_TIERS, []],
                    [SELECT_PROMO_HISTORY, []],
                ],
            })
            const { billing, orders } = await build(em)

            await expect(billing.orderPlan("person-1", { workspaceId: "ws-1", planCode: "starter" })).resolves.toEqual(
                PAYABLE,
            )
            expect(orders.create).toHaveBeenCalledWith(
                expect.objectContaining({ planCode: "starter", amountVnd: 990000, detail: PLAN_DETAIL }),
            )
        })

        it("prices a per-seat plan from the level and the seats the caller picked", async () => {
            const tier = { plan_code: "team", credits_per_month: 5000, price_vnd: 200000, per_seat: true }
            const { billing, orders } = await build(
                mockEntityManager({
                    query: [
                        [SELECT_MEMBER_ROLE, [{ role: "manager" }]],
                        [
                            SELECT_PLAN,
                            [{ ...PLAN_ROW, code: "team", per_seat: true, seats: 10, ai_credits_per_month: null }],
                        ],
                        [SELECT_PLAN_TIERS, [tier]],
                        [SELECT_PROMO_HISTORY, []],
                    ],
                }),
            )

            await billing.orderPlan("person-1", {
                workspaceId: "ws-1",
                planCode: "team",
                selection: { cycle: "monthly", tierCredits: 5000, seats: 2 },
            })

            expect(orders.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    planCode: "team",
                    amountVnd: 400000,
                    detail: {
                        cycle: "monthly",
                        months: 1,
                        tierCredits: 5000,
                        seats: 2,
                        promo: false,
                        listMonthlyVnd: 400000,
                    },
                }),
            )
        })

        it.each([
            ["another plan", [{ ...WORKSPACE_ROW, plan_code: "growth" }]],
            ["no workspace", []],
        ])("refuses an unlisted plan of %s", async (_label, workspace) => {
            const { billing, orders } = await build(
                mockEntityManager({
                    query: [
                        [SELECT_MEMBER_ROLE, [{ role: "manager" }]],
                        [SELECT_PLAN, [{ ...PLAN_ROW, listed: false }]],
                        [SELECT_PLAN_TIERS, []],
                        [SELECT_WORKSPACE_BILLING, workspace],
                    ],
                }),
            )

            await expect(
                billing.orderPlan("person-1", { workspaceId: "ws-1", planCode: "starter" }),
            ).rejects.toMatchObject({ code: BillingErrorCode.PlanNotListed, params: { plan: "starter" } })
            expect(orders.create).not.toHaveBeenCalled()
        })

        it("lets a workspace pay again for the unlisted plan it already has", async () => {
            const { billing, orders } = await build(
                mockEntityManager({
                    query: [
                        [SELECT_MEMBER_ROLE, [{ role: "manager" }]],
                        [SELECT_PLAN, [{ ...PLAN_ROW, listed: false }]],
                        [SELECT_PLAN_TIERS, []],
                        [SELECT_WORKSPACE_BILLING, [WORKSPACE_ROW]],
                        [SELECT_PROMO_HISTORY, []],
                    ],
                }),
            )

            await expect(billing.orderPlan("person-1", { workspaceId: "ws-1", planCode: "starter" })).resolves.toEqual(
                PAYABLE,
            )
            expect(orders.create).toHaveBeenCalledWith(expect.objectContaining({ planCode: "starter" }))
        })

        it("refuses an unknown plan", async () => {
            const em = mockEntityManager({
                query: [
                    [SELECT_MEMBER_ROLE, [{ role: "manager" }]],
                    [SELECT_PLAN, []],
                ],
            })
            const { billing } = await build(em)

            await expect(
                billing.orderPlan("person-1", { workspaceId: "ws-1", planCode: "nope" }),
            ).rejects.toMatchObject({
                code: BillingErrorCode.PlanNotFound,
            })
        })
    })

    describe("workspaces", () => {
        const row = {
            id: "ws-1",
            name: "Shop",
            role: "owner",
            ...WORKSPACE_ROW,
            paid_until: "2026-11-01T00:00:00.000Z",
        }

        it("lists the caller's active workspaces", async () => {
            const { billing } = await build(mockEntityManager({ query: [SELECT_BILLING_WORKSPACES, [row]] }))

            await expect(billing.workspaces("person-1")).resolves.toEqual([
                {
                    id: "ws-1",
                    name: "Shop",
                    role: "owner",
                    status: "active",
                    planCode: "starter",
                    paidUntil: "2026-11-01T00:00:00.000Z",
                    tierCredits: null,
                    seatCount: null,
                    billingCycle: null,
                    billedMonthlyVnd: null,
                },
            ])
        })

        it("reads one workspace for a member and refuses anyone else", async () => {
            const { billing } = await build(mockEntityManager({ query: [SELECT_BILLING_WORKSPACE, [row]] }))
            const { billing: outsider } = await build(mockEntityManager({ query: [SELECT_BILLING_WORKSPACE, []] }))

            await expect(billing.workspace("person-1", "ws-1")).resolves.toMatchObject({ id: "ws-1", role: "owner" })
            await expect(outsider.workspace("person-1", "ws-1")).rejects.toMatchObject({
                code: BillingErrorCode.NotMember,
            })
        })
    })

    describe("quote", () => {
        it("prices the intro offer while the workspace has not paid full price", async () => {
            const { billing } = await build(
                mockEntityManager({
                    query: [
                        [SELECT_MEMBER_ROLE, [{ role: "staff" }]],
                        [SELECT_PLAN, [{ ...PLAN_ROW, promo_price_vnd: 490000, promo_months: 2 }]],
                        [SELECT_PLAN_TIERS, []],
                        [SELECT_PROMO_HISTORY, [{ full_price: 0, promo: 0 }]],
                    ],
                }),
            )

            await expect(billing.quote("person-1", { workspaceId: "ws-1", planCode: "starter" })).resolves.toEqual({
                planCode: "starter",
                cycle: "monthly",
                months: 1,
                amountVnd: 490000,
                listMonthlyVnd: 990000,
                promo: true,
                tierCredits: null,
                seats: 1,
                creditsPerMonth: 3000,
            })
        })

        it("stops at membership and reads nothing else", async () => {
            const em = mockEntityManager({ query: [SELECT_MEMBER_ROLE, []] })
            const { billing } = await build(em)

            await expect(billing.quote("person-1", { workspaceId: "ws-1", planCode: "starter" })).rejects.toMatchObject(
                {
                    code: BillingErrorCode.NotMember,
                },
            )
            expect(em.query).toHaveBeenCalledTimes(1)
        })
    })
})
