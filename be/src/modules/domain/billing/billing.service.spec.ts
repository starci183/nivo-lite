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
    SELECT_MEMBER_ROLE,
    SELECT_PLAN,
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
    it("lists the active plans", async () => {
        const { billing } = await build(mockEntityManager({ query: [SELECT_ACTIVE_PLANS, [PLAN_ROW]] }))

        await expect(billing.listPlans()).resolves.toMatchObject([{ code: "starter", priceVnd: 990000 }])
    })

    it("finds a plan, answers null for an unknown code and refuses to require it", async () => {
        const { billing } = await build(mockEntityManager({ query: [SELECT_PLAN, [PLAN_ROW]] }))
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
        const row = { status: "active", plan_code: "starter", paid_until: null }
        const { billing } = await build(mockEntityManager({ query: [SELECT_WORKSPACE_BILLING, [row]] }))
        const { billing: none } = await build(mockEntityManager({ query: [SELECT_WORKSPACE_BILLING, []] }))

        await expect(billing.findWorkspaceBilling("ws-1")).resolves.toEqual({
            status: "active",
            planCode: "starter",
            paidUntil: null,
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
        const WORKSPACE = [{ status: "active", plan_code: "starter", paid_until: null }]

        it("orders the current plan of the workspace at its price", async () => {
            const { billing, orders } = await build(
                mockEntityManager({
                    query: [
                        [SELECT_MEMBER_ROLE, [{ role: "owner" }]],
                        [SELECT_WORKSPACE_BILLING, WORKSPACE],
                        [SELECT_PLAN, [PLAN_ROW]],
                    ],
                }),
            )

            await expect(billing.renew("person-1", { workspaceId: "ws-1" })).resolves.toEqual(PAYABLE)
            expect(orders.create).toHaveBeenCalledWith({
                workspaceId: "ws-1",
                userId: "person-1",
                planCode: "starter",
                amountVnd: 990000,
                kind: "plan",
                packCode: null,
                detail: {},
            })
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
                mockEntityManager({
                    query: [
                        [SELECT_MEMBER_ROLE, [{ role: "owner" }]],
                        [SELECT_WORKSPACE_BILLING, WORKSPACE],
                        [SELECT_PLAN, [{ ...PLAN_ROW, is_custom: true }]],
                    ],
                }),
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
                ],
            })
            const { billing } = await build(em)

            await expect(billing.orderPlan("person-1", { workspaceId: "ws-1", planCode: "starter" })).resolves.toEqual(
                PAYABLE,
            )
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
})
