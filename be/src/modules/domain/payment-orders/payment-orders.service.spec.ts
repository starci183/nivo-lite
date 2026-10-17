import { Test } from "@nestjs/testing"
import { FakeClock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { PaymentOrdersErrorCode } from "./errors/payment-orders.error"
import type { PaymentOrder } from "./payment-orders.contracts"
import { PaymentOrdersService } from "./payment-orders.service"
import type { OrderRow } from "./persistence/payment-orders.rows"
import {
    INSERT_PAYMENT_ORDER,
    SELECT_OPEN_CREDIT_PACK_ORDER,
    SELECT_OPEN_PLAN_ORDER,
    SELECT_OPEN_TOPUP_ORDER,
    SELECT_OPEN_UPGRADE_ORDER,
    SELECT_PAYMENT_ORDER,
    SELECT_PAYMENT_ORDERS,
} from "./persistence/payment-orders.sql"

const NOW = "2026-10-12T10:00:00.000Z"
const ROW = {
    id: "order-1",
    workspace_id: "ws-1",
    plan_code: "starter",
    amount_vnd: 990000,
    order_code: "NIVO8F3K2",
    status: "pending",
    expires_at: "2026-10-12T10:30:00.000Z",
    paid_at: null,
    created_at: NOW,
    kind: "plan",
    pack_code: null,
    detail: {},
}
const NEW_ORDER = {
    workspaceId: "ws-1",
    userId: "person-1",
    planCode: "starter",
    amountVnd: 990000,
    kind: "plan" as const,
    packCode: null,
    detail: { credits: 5 },
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
    createdAt: NOW,
    kind: "plan",
    packCode: null,
    detail: {},
}

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            PaymentOrdersService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
        ],
    }).compile()
    return moduleRef.get(PaymentOrdersService)
}

describe("PaymentOrdersService", () => {
    it("maps every listed order for the requested workspace", async () => {
        const em = mockEntityManager({ query: [SELECT_PAYMENT_ORDERS, [ROW, { ...ROW, id: "order-2" }]] })
        const orders = await build(em)

        await expect(orders.list("ws-1")).resolves.toEqual([ORDER, { ...ORDER, id: "order-2" }])

        expect(em.query.mock.calls).toEqual([[SELECT_PAYMENT_ORDERS, ["ws-1"]]])
    })

    it.each<{ rows: Array<OrderRow>; expected: PaymentOrder | null }>([
        { rows: [], expected: null },
        { rows: [{ ...ROW, status: "pending", kind: "plan" }], expected: ORDER },
        {
            rows: [{ ...ROW, status: "pending", kind: "plan", expires_at: "2026-10-12T09:59:59.999Z" }],
            expected: { ...ORDER, status: "expired", expiresAt: "2026-10-12T09:59:59.999Z" },
        },
        {
            rows: [{ ...ROW, status: "pending", kind: "plan", expires_at: NOW }],
            expected: { ...ORDER, expiresAt: NOW },
        },
        {
            rows: [{ ...ROW, status: "paid", kind: "plan", expires_at: "2026-10-12T09:59:59.999Z", paid_at: NOW }],
            expected: { ...ORDER, status: "paid", expiresAt: "2026-10-12T09:59:59.999Z", paidAt: NOW },
        },
    ])("looks up the scoped order and expires only a lapsed pending order: $expected", async ({ rows, expected }) => {
        const em = mockEntityManager({ query: [SELECT_PAYMENT_ORDER, rows] })
        const orders = await build(em)

        await expect(orders.find("ws-1", "order-1")).resolves.toEqual(expected)

        expect(em.query.mock.calls).toEqual([[SELECT_PAYMENT_ORDER, ["ws-1", "order-1"]]])
    })

    it.each([
        { rows: [ROW], expected: ORDER },
        { rows: [], expected: null },
    ])("finds a payable plan order at the clock's current instant: $expected", async ({ rows, expected }) => {
        const em = mockEntityManager({ query: [SELECT_OPEN_PLAN_ORDER, rows] })
        const orders = await build(em)

        await expect(orders.findOpenPlan("ws-1")).resolves.toEqual(expected)

        expect(em.query.mock.calls).toEqual([[SELECT_OPEN_PLAN_ORDER, ["ws-1", new Date(NOW)]]])
    })
})

describe("PaymentOrdersService", () => {
    describe("create", () => {
        it("writes the pending order with a fresh code and answers it", async () => {
            const em = mockEntityManager({ query: [INSERT_PAYMENT_ORDER, [ROW]] })
            const orders = await build(em)

            await expect(orders.create(NEW_ORDER)).resolves.toMatchObject({ id: "order-1", orderCode: "NIVO8F3K2" })

            expect(em.query).toHaveBeenCalledWith(INSERT_PAYMENT_ORDER, [
                "ws-1",
                "person-1",
                "starter",
                990000,
                expect.stringMatching(/^NIVO[2-9A-HJKMNP-Z]{5}$/),
                "plan",
                null,
                JSON.stringify({ credits: 5 }),
            ])
        })

        it("draws a new code when the first one collides", async () => {
            const em = mockEntityManager({
                query: [
                    [INSERT_PAYMENT_ORDER, []],
                    [INSERT_PAYMENT_ORDER, [ROW]],
                ],
            })
            const orders = await build(em)

            await expect(orders.create(NEW_ORDER)).resolves.toMatchObject({ id: "order-1" })
            expect(em.query).toHaveBeenCalledTimes(2)
        })

        it("gives up after five collisions", async () => {
            const em = mockEntityManager({
                query: Array.from({ length: 5 }, () => [INSERT_PAYMENT_ORDER, []] as const),
            })
            const orders = await build(em)

            await expect(orders.create(NEW_ORDER)).rejects.toMatchObject({ code: PaymentOrdersErrorCode.CodeExhausted })
            expect(em.query).toHaveBeenCalledTimes(5)
        })
    })
})

describe("PaymentOrdersService", () => {
    describe("open orders", () => {
        const query = { workspaceId: "ws-1", target: "credits_1000", amountVnd: 299000 }

        it.each([
            { rows: [ROW], expected: ORDER },
            { rows: [], expected: null },
        ])(
            "finds an open add-on order for the exact credit target and amount: $expected",
            async ({ rows, expected }) => {
                const em = mockEntityManager({ query: [SELECT_OPEN_CREDIT_PACK_ORDER, rows] })
                const orders = await build(em)

                await expect(orders.findOpenCreditPack(query)).resolves.toEqual(expected)

                expect(em.query.mock.calls).toEqual([
                    [SELECT_OPEN_CREDIT_PACK_ORDER, ["ws-1", "credits_1000", 299000, new Date(NOW)]],
                ])
            },
        )

        it("finds the pending top-up order for the pack and amount, or none", async () => {
            const hit = mockEntityManager({ query: [SELECT_OPEN_TOPUP_ORDER, [ROW]] })
            const found = await build(hit)
            const miss = await build(mockEntityManager({ query: [SELECT_OPEN_TOPUP_ORDER, []] }))

            await expect(found.findOpenTopup(query)).resolves.toMatchObject({ id: "order-1" })
            expect(hit.query).toHaveBeenCalledWith(SELECT_OPEN_TOPUP_ORDER, [
                "ws-1",
                "credits_1000",
                299000,
                new Date(NOW),
            ])
            await expect(miss.findOpenTopup(query)).resolves.toBeNull()
        })

        it("finds the pending upgrade order for the plan and amount, or none", async () => {
            const hit = mockEntityManager({ query: [SELECT_OPEN_UPGRADE_ORDER, [ROW]] })
            const found = await build(hit)
            const miss = await build(mockEntityManager({ query: [SELECT_OPEN_UPGRADE_ORDER, []] }))

            await expect(found.findOpenUpgrade(query)).resolves.toMatchObject({ id: "order-1" })
            expect(hit.query).toHaveBeenCalledWith(SELECT_OPEN_UPGRADE_ORDER, [
                "ws-1",
                "credits_1000",
                299000,
                new Date(NOW),
            ])
            await expect(miss.findOpenUpgrade(query)).resolves.toBeNull()
        })
    })
})
