import { Test } from "@nestjs/testing"
import { FakeClock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { In, MoreThan } from "typeorm"
import { answerQueryBuilders, fakeQueryBuilder } from "@tests/fixtures/builders/fake-query-builder.builder"
import {
    AT_DEADLINE_ROW,
    LAPSED_ROW,
    PAID_LAPSED_ROW,
    PAYMENT_ORDER_NOW,
    SECOND_ROW,
    paymentOrderRowOf,
} from "@tests/fixtures/builders/payment-orders.builder"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { PaymentOrdersErrorCode } from "./errors/payment-orders.error"
import type { PaymentOrder } from "./payment-orders.contracts"
import { PaymentOrdersService } from "./payment-orders.service"
import { PaymentOrderEntity } from "./persistence/entities"

const NOW = PAYMENT_ORDER_NOW
const ROW = paymentOrderRowOf()
/** Any freshly drawn order code. */
const DRAWN_CODE: unknown = expect.stringMatching(/^NIVO[2-9A-HJKMNP-Z]{5}$/)
/** What the insert answers with `RETURNING *`. */
const WRITTEN = {
    id: "order-1",
    workspace_id: "ws-1",
    plan_code: "starter",
    amount_vnd: "990000",
    order_code: "NIVO8F3K2",
    status: "pending",
    expires_at: new Date("2026-10-12T10:30:00.000Z"),
    paid_at: null,
    created_at: new Date(NOW),
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
        const em = mockEntityManager({ find: [PaymentOrderEntity, [ROW, SECOND_ROW]] })
        const orders = await build(em)

        await expect(orders.list("ws-1")).resolves.toEqual([ORDER, { ...ORDER, id: "order-2" }])

        expect(em.find).toHaveBeenCalledWith(PaymentOrderEntity, {
            where: { workspaceId: "ws-1" },
            order: { createdAt: "DESC" },
            take: 50,
        })
    })

    it.each<{ row: PaymentOrderEntity | null; expected: PaymentOrder | null }>([
        { row: null, expected: null },
        { row: paymentOrderRowOf(), expected: ORDER },
        {
            row: LAPSED_ROW,
            expected: { ...ORDER, status: "expired", expiresAt: "2026-10-12T09:59:59.999Z" },
        },
        {
            row: AT_DEADLINE_ROW,
            expected: { ...ORDER, expiresAt: NOW },
        },
        {
            row: PAID_LAPSED_ROW,
            expected: { ...ORDER, status: "paid", expiresAt: "2026-10-12T09:59:59.999Z", paidAt: NOW },
        },
    ])("looks up the scoped order and expires only a lapsed pending order: $expected", async ({ row, expected }) => {
        const em = mockEntityManager({ findOne: [PaymentOrderEntity, row] })
        const orders = await build(em)

        await expect(orders.find("ws-1", "order-1")).resolves.toEqual(expected)

        expect(em.findOne).toHaveBeenCalledWith(PaymentOrderEntity, { where: { workspaceId: "ws-1", id: "order-1" } })
    })

    it.each([
        { row: ROW, expected: ORDER },
        { row: null, expected: null },
    ])("finds a payable plan order at the clock's current instant: $expected", async ({ row, expected }) => {
        const em = mockEntityManager({ findOne: [PaymentOrderEntity, row] })
        const orders = await build(em)

        await expect(orders.findOpenPlan("ws-1")).resolves.toEqual(expected)

        expect(em.findOne).toHaveBeenCalledWith(PaymentOrderEntity, {
            where: { workspaceId: "ws-1", kind: "plan", status: "pending", expiresAt: MoreThan(new Date(NOW)) },
            order: { createdAt: "DESC" },
        })
    })
})

describe("PaymentOrdersService", () => {
    describe("idsOfWorkspace", () => {
        it("asks for nothing when no id is given", async () => {
            const em = mockEntityManager()

            await expect((await build(em)).idsOfWorkspace("ws-1", [])).resolves.toEqual([])
            expect(em.find).not.toHaveBeenCalled()
        })

        it("answers the given ids that are orders of the workspace", async () => {
            const em = mockEntityManager({ find: [PaymentOrderEntity, [paymentOrderRowOf()]] })

            await expect((await build(em)).idsOfWorkspace("ws-1", ["order-1", "order-1", "foreign"])).resolves.toEqual([
                "order-1",
            ])
            expect(em.find).toHaveBeenCalledWith(PaymentOrderEntity, {
                select: { id: true },
                where: { workspaceId: "ws-1", id: In(["order-1", "foreign"]) },
            })
        })
    })

    describe("create", () => {
        it("writes the pending order with a fresh code and answers it", async () => {
            const em = mockEntityManager()
            const insert = fakeQueryBuilder({ execute: { raw: [WRITTEN] } })
            answerQueryBuilders(em, insert)
            const orders = await build(em)

            await expect(orders.create(NEW_ORDER)).resolves.toMatchObject({ id: "order-1", orderCode: "NIVO8F3K2" })

            expect(insert.argsOf("values")).toEqual([
                [
                    {
                        workspaceId: "ws-1",
                        createdBy: "person-1",
                        planCode: "starter",
                        amountVnd: 990000,
                        orderCode: DRAWN_CODE,
                        kind: "plan",
                        packCode: null,
                        detail: { credits: 5 },
                    },
                ],
            ])
            expect(insert.argsOf("orUpdate")).toEqual([
                [["order_code"], ["order_code"], { skipUpdateIfNoValuesChanged: true }],
            ])
            expect(insert.argsOf("orIgnore")).toHaveLength(0)
        })

        it("draws a new code when the first one collides", async () => {
            const em = mockEntityManager()
            answerQueryBuilders(
                em,
                fakeQueryBuilder({ execute: { raw: [] } }),
                fakeQueryBuilder({ execute: { raw: [WRITTEN] } }),
            )
            const orders = await build(em)

            await expect(orders.create(NEW_ORDER)).resolves.toMatchObject({ id: "order-1" })
            expect(em.createQueryBuilder).toHaveBeenCalledTimes(2)
        })

        it("gives up after five collisions", async () => {
            const em = mockEntityManager()
            answerQueryBuilders(em, fakeQueryBuilder({ execute: { raw: [] } }))
            const orders = await build(em)

            await expect(orders.create(NEW_ORDER)).rejects.toMatchObject({ code: PaymentOrdersErrorCode.CodeExhausted })
            expect(em.createQueryBuilder).toHaveBeenCalledTimes(5)
        })
    })
})

describe("PaymentOrdersService", () => {
    describe("open orders", () => {
        const query = { workspaceId: "ws-1", target: "credits_1000", amountVnd: 299000 }
        const NOW_DATE = new Date(NOW)

        it.each([
            { row: ROW, expected: ORDER },
            { row: null, expected: null },
        ])(
            "finds an open add-on order for the exact credit target and amount: $expected",
            async ({ row, expected }) => {
                const em = mockEntityManager()
                const open = fakeQueryBuilder({ getOne: row })
                answerQueryBuilders(em, open)
                const orders = await build(em)

                await expect(orders.findOpenCreditPack(query)).resolves.toEqual(expected)

                expect(open.argsOf("where")).toEqual([
                    [
                        "o.workspaceId = :workspaceId AND o.kind = :kind AND o.status = 'pending'",
                        { workspaceId: "ws-1", kind: "credit_pack" },
                    ],
                ])
                expect(open.argsOf("andWhere")).toEqual([
                    ["o.amountVnd = :amountVnd AND o.expiresAt > :now", { amountVnd: 299000, now: NOW_DATE }],
                    ["o.detail ->> 'credits' = :target", { target: "credits_1000" }],
                ])
            },
        )

        it("finds the pending top-up order for the pack and amount, or none", async () => {
            const em = mockEntityManager()
            const hit = fakeQueryBuilder({ getOne: ROW })
            answerQueryBuilders(em, hit, fakeQueryBuilder({ getOne: null }))
            const orders = await build(em)

            await expect(orders.findOpenTopup(query)).resolves.toMatchObject({ id: "order-1" })
            expect(hit.argsOf("andWhere")[1]).toEqual(["o.packCode = :target", { target: "credits_1000" }])
            expect(hit.argsOf("where")[0]?.[1]).toEqual({ workspaceId: "ws-1", kind: "topup" })
            await expect(orders.findOpenTopup(query)).resolves.toBeNull()
        })

        it("finds the pending upgrade order for the plan and amount, or none", async () => {
            const em = mockEntityManager()
            const hit = fakeQueryBuilder({ getOne: ROW })
            answerQueryBuilders(em, hit, fakeQueryBuilder({ getOne: null }))
            const orders = await build(em)

            await expect(orders.findOpenUpgrade(query)).resolves.toMatchObject({ id: "order-1" })
            expect(hit.argsOf("andWhere")[1]).toEqual(["o.planCode = :target", { target: "credits_1000" }])
            expect(hit.argsOf("where")[0]?.[1]).toEqual({ workspaceId: "ws-1", kind: "upgrade" })
            await expect(orders.findOpenUpgrade(query)).resolves.toBeNull()
        })
    })
})
