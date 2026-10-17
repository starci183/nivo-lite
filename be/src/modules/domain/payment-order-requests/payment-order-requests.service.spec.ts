import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { BillingError, BillingErrorCode, BillingService } from "@modules/domain/billing"
import type { PayableOrder } from "@modules/domain/billing"
import { CreditsError, CreditsErrorCode, CreditsService } from "@modules/domain/credits"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { PaymentOrderRequestsErrorCode } from "./errors/payment-order-requests.error"
import { PAYMENT_ORDER_REQUEST_QUEUE } from "./payment-order-requests.contracts"
import type { PaymentOrderRequestParams, PaymentOrderRequestStatus } from "./payment-order-requests.contracts"
import { PaymentOrderRequestsService } from "./payment-order-requests.service"
import type { RequestRow, RequestStatusRow } from "./persistence/payment-order-requests.rows"
import {
    ENQUEUE_REQUEST,
    INSERT_REQUEST,
    MARK_EXHAUSTED_REQUEST_FAILED,
    MARK_REQUEST_DONE,
    MARK_REQUEST_FAILED,
    SELECT_REQUEST,
    SELECT_REQUEST_STATUS,
} from "./persistence/payment-order-requests.sql"

const PAYLOAD = { requestId: "request-1", workspaceId: "ws-1" }
const REQUEST: RequestRow = {
    id: "request-1",
    workspace_id: "ws-1",
    requested_by: "person-1",
    kind: "plan",
    target: "starter",
    cycle: null,
    tier_credits: null,
    seats: null,
    status: "pending",
}
const PAYABLE: PayableOrder = {
    order: {
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
    },
    qrUrl: "https://qr.sepay.vn/img?acc=0123&bank=MB&amount=990000&des=NIVO8F3K2&template=compact",
    bank: { account: "0123", bank: "MB", holder: "NIVO" },
}

const build = async (entityManager: MockEntityManager) => {
    const billing = mock<BillingService>()
    billing.orderPlan.mockResolvedValue(PAYABLE)
    billing.renew.mockResolvedValue(PAYABLE)
    const credits = mock<CreditsService>()
    credits.topup.mockResolvedValue(PAYABLE)
    credits.upgrade.mockResolvedValue({
        payable: PAYABLE,
        quote: { amount: 990000, credit: 0, daysLeft: 0, fromCode: "starter" },
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            PaymentOrderRequestsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: BillingService, useValue: billing },
            { provide: CreditsService, useValue: credits },
        ],
    }).compile()
    return { requests: moduleRef.get(PaymentOrderRequestsService), billing, credits }
}

const expectAnswered = (entityManager: MockEntityManager) => {
    expect(entityManager.query).toHaveBeenCalledTimes(2)
    expect(entityManager.query).toHaveBeenNthCalledWith(1, SELECT_REQUEST, ["request-1", "ws-1"])
    expect(entityManager.query).toHaveBeenNthCalledWith(2, MARK_REQUEST_DONE, ["request-1", "order-1"])
}

describe("PaymentOrderRequestsService", () => {
    it.each<{
        params: PaymentOrderRequestParams
        values: Array<string | number | null>
        plan: string | null
        packs: boolean
    }>([
        {
            params: { workspaceId: "ws-1", kind: "plan", target: "team", cycle: "annual", tierCredits: 500, seats: 3 },
            values: ["plan", "team", "annual", 500, 3],
            plan: "team",
            packs: false,
        },
        {
            params: { workspaceId: "ws-1", kind: "renew" },
            values: ["renew", null, null, null, null],
            plan: null,
            packs: false,
        },
        {
            params: { workspaceId: "ws-1", kind: "topup", target: "credits_1000" },
            values: ["topup", "credits_1000", null, null, null],
            plan: null,
            packs: true,
        },
        {
            params: { workspaceId: "ws-1", kind: "credit_pack", target: "500" },
            values: ["credit_pack", "500", null, null, null],
            plan: null,
            packs: false,
        },
    ])(
        "queues an authorized $params.kind request and job in one transaction",
        async ({ params, values, plan, packs }) => {
            const em = mockEntityManager({
                query: [
                    [INSERT_REQUEST, [{ id: "request-1" }]],
                    [ENQUEUE_REQUEST, []],
                ],
            })
            const tx = fakeTransaction(em)
            const { requests, billing, credits } = await build(em)
            credits.listPacks.mockResolvedValue([{ code: "credits_1000", credits: 1000, priceVnd: 299000, sort: 1 }])

            await expect(requests.request("person-1", params)).resolves.toEqual({ id: "request-1", status: "queued" })

            expect(billing.requireManager.mock.calls).toEqual([["person-1", "ws-1"]])
            expect(billing.requirePlan.mock.calls).toEqual(plan === null ? [] : [[plan]])
            expect(credits.listPacks).toHaveBeenCalledTimes(packs ? 1 : 0)
            expect(em.query.mock.calls).toEqual([
                [INSERT_REQUEST, ["ws-1", "person-1", ...values]],
                [ENQUEUE_REQUEST, ["ws-1", PAYMENT_ORDER_REQUEST_QUEUE, "request-1"]],
            ])
            expect(tx.outcomes).toEqual(["commit"])
        },
    )
})

describe("PaymentOrderRequestsService", () => {
    it("rolls back without queuing when insertion does not produce a request id", async () => {
        const em = mockEntityManager({ query: [INSERT_REQUEST, []] })
        const tx = fakeTransaction(em)
        const { requests } = await build(em)

        await expect(requests.request("person-1", { workspaceId: "ws-1", kind: "renew" })).rejects.toMatchObject({
            code: PaymentOrderRequestsErrorCode.NotCreated,
        })

        expect(em.query.mock.calls).toEqual([[INSERT_REQUEST, ["ws-1", "person-1", "renew", null, null, null, null]]])
        expect(tx.outcomes).toEqual(["rollback"])
        expect(tx.committedWrites).toEqual([])
    })

    it("refuses an unknown top-up pack before opening a transaction", async () => {
        const em = mockEntityManager({})
        const { requests, credits } = await build(em)
        credits.listPacks.mockResolvedValue([{ code: "other", credits: 1000, priceVnd: 299000, sort: 1 }])

        await expect(
            requests.request("person-1", { workspaceId: "ws-1", kind: "topup", target: "missing" }),
        ).rejects.toMatchObject({
            code: CreditsErrorCode.PackNotFound,
        })

        expect(credits.listPacks.mock.calls).toEqual([[]])
        expect(em.transaction).not.toHaveBeenCalled()
        expect(em.query).not.toHaveBeenCalled()
    })

    it.each<{ rows: Array<RequestStatusRow>; expected: PaymentOrderRequestStatus | null }>([
        { rows: [], expected: null },
        {
            rows: [{ id: "request-1", status: "pending", order_id: null, fault: null }],
            expected: { id: "request-1", status: "queued", resultId: null, errorCode: null },
        },
        {
            rows: [{ id: "request-1", status: "done", order_id: "order-1", fault: null }],
            expected: { id: "request-1", status: "succeeded", resultId: "order-1", errorCode: null },
        },
        {
            rows: [{ id: "request-1", status: "failed", order_id: null, fault: "BILLING_FORBIDDEN" }],
            expected: { id: "request-1", status: "failed", resultId: null, errorCode: "BILLING_FORBIDDEN" },
        },
    ])("looks up only the manager's request and maps its stored status: $expected", async ({ rows, expected }) => {
        const em = mockEntityManager({ query: [SELECT_REQUEST_STATUS, rows] })
        const { requests, billing } = await build(em)

        await expect(requests.status("person-1", "ws-1", "request-1")).resolves.toEqual(expected)

        expect(billing.requireManager.mock.calls).toEqual([["person-1", "ws-1"]])
        expect(em.query.mock.calls).toEqual([[SELECT_REQUEST_STATUS, ["request-1", "ws-1", "person-1"]]])
    })

    it("ignores an unrelated terminal failure payload", async () => {
        const em = mockEntityManager({})
        const { requests } = await build(em)

        await expect(requests.fail(null, new Error("queue failure"))).resolves.toBeUndefined()

        expect(em.query).not.toHaveBeenCalled()
    })
})

describe("PaymentOrderRequestsService", () => {
    it.each([
        { cause: new BillingError({ code: BillingErrorCode.Forbidden }), code: BillingErrorCode.Forbidden },
        { cause: new Error("queue failure"), code: PaymentOrderRequestsErrorCode.JobFailed },
    ])("records the terminal failure's stable code $code", async ({ cause, code }) => {
        const em = mockEntityManager({ query: [MARK_EXHAUSTED_REQUEST_FAILED, []] })
        const { requests } = await build(em)

        await expect(requests.fail(PAYLOAD, cause)).resolves.toBeUndefined()

        expect(em.query.mock.calls).toEqual([[MARK_EXHAUSTED_REQUEST_FAILED, ["request-1", "ws-1", code]]])
    })

    it("uses the stored annual selection when answering a plan request", async () => {
        const em = mockEntityManager({
            query: [
                [SELECT_REQUEST, [{ ...REQUEST, cycle: "annual", tier_credits: 500, seats: 3 }]],
                [MARK_REQUEST_DONE, []],
            ],
        })
        const { requests, billing } = await build(em)

        await expect(requests.answer(PAYLOAD)).resolves.toBe("ordered")

        expect(billing.orderPlan.mock.calls).toEqual([
            [
                "person-1",
                {
                    workspaceId: "ws-1",
                    planCode: "starter",
                    selection: { cycle: "annual", tierCredits: 500, seats: 3 },
                },
            ],
        ])
        expectAnswered(em)
    })

    it("converts the stored add-on credit target into the ordered credits", async () => {
        const em = mockEntityManager({
            query: [
                [SELECT_REQUEST, [{ ...REQUEST, kind: "credit_pack", target: "500" }]],
                [MARK_REQUEST_DONE, []],
            ],
        })
        const { requests, credits } = await build(em)
        credits.creditPack.mockResolvedValue(PAYABLE)

        await expect(requests.answer(PAYLOAD)).resolves.toBe("ordered")

        expect(credits.creditPack.mock.calls).toEqual([["person-1", { workspaceId: "ws-1", credits: 500 }]])
        expectAnswered(em)
    })

    it("ignores a payload from another job without reading the database", async () => {
        const em = mockEntityManager({})
        const { requests, billing, credits } = await build(em)

        await expect(requests.answer({ requestId: "request-1" })).resolves.toBe("ignored")

        expect(em.query).not.toHaveBeenCalled()
        expect(billing.orderPlan).not.toHaveBeenCalled()
        expect(billing.renew).not.toHaveBeenCalled()
        expect(credits.topup).not.toHaveBeenCalled()
        expect(credits.upgrade).not.toHaveBeenCalled()
    })
})

describe("PaymentOrderRequestsService", () => {
    it.each([{ rows: [] }, { rows: [{ ...REQUEST, status: "done" }] }, { rows: [{ ...REQUEST, status: "failed" }] }])(
        "ignores a missing or already answered request: $rows",
        async ({ rows }) => {
            const em = mockEntityManager({ query: [SELECT_REQUEST, rows] })
            const { requests, billing, credits } = await build(em)

            await expect(requests.answer(PAYLOAD)).resolves.toBe("ignored")

            expect(em.query).toHaveBeenCalledTimes(1)
            expect(em.query).toHaveBeenCalledWith(SELECT_REQUEST, ["request-1", "ws-1"])
            expect(billing.orderPlan).not.toHaveBeenCalled()
            expect(billing.renew).not.toHaveBeenCalled()
            expect(credits.topup).not.toHaveBeenCalled()
            expect(credits.upgrade).not.toHaveBeenCalled()
        },
    )

    it("orders the plan using the requester and target from the database", async () => {
        const em = mockEntityManager({
            query: [
                [SELECT_REQUEST, [REQUEST]],
                [MARK_REQUEST_DONE, []],
            ],
        })
        const { requests, billing, credits } = await build(em)

        await expect(requests.answer({ ...PAYLOAD, requestedBy: "other-person", target: "other-plan" })).resolves.toBe(
            "ordered",
        )

        expect(billing.orderPlan.mock.calls).toEqual([
            [
                "person-1",
                {
                    workspaceId: "ws-1",
                    planCode: "starter",
                    selection: { cycle: "monthly", tierCredits: null, seats: 1 },
                },
            ],
        ])
        expect(billing.renew).not.toHaveBeenCalled()
        expect(credits.topup).not.toHaveBeenCalled()
        expect(credits.upgrade).not.toHaveBeenCalled()
        expectAnswered(em)
    })

    it("renews the workspace without a target", async () => {
        const em = mockEntityManager({
            query: [
                [SELECT_REQUEST, [{ ...REQUEST, kind: "renew", target: null }]],
                [MARK_REQUEST_DONE, []],
            ],
        })
        const { requests, billing, credits } = await build(em)

        await expect(requests.answer(PAYLOAD)).resolves.toBe("ordered")

        expect(billing.renew.mock.calls).toEqual([["person-1", { workspaceId: "ws-1" }]])
        expect(billing.orderPlan).not.toHaveBeenCalled()
        expect(credits.topup).not.toHaveBeenCalled()
        expect(credits.upgrade).not.toHaveBeenCalled()
        expectAnswered(em)
    })
})

describe("PaymentOrderRequestsService", () => {
    it("tops up the pack from the database", async () => {
        const em = mockEntityManager({
            query: [
                [SELECT_REQUEST, [{ ...REQUEST, kind: "topup", target: "credits_1000" }]],
                [MARK_REQUEST_DONE, []],
            ],
        })
        const { requests, billing, credits } = await build(em)

        await expect(requests.answer(PAYLOAD)).resolves.toBe("ordered")

        expect(credits.topup.mock.calls).toEqual([["person-1", { workspaceId: "ws-1", packCode: "credits_1000" }]])
        expect(billing.orderPlan).not.toHaveBeenCalled()
        expect(billing.renew).not.toHaveBeenCalled()
        expect(credits.upgrade).not.toHaveBeenCalled()
        expectAnswered(em)
    })

    it("answers an upgrade with the id of its payable order", async () => {
        const em = mockEntityManager({
            query: [
                [SELECT_REQUEST, [{ ...REQUEST, kind: "upgrade", target: "growth" }]],
                [MARK_REQUEST_DONE, []],
            ],
        })
        const { requests, billing, credits } = await build(em)

        await expect(requests.answer(PAYLOAD)).resolves.toBe("ordered")

        expect(credits.upgrade.mock.calls).toEqual([["person-1", { workspaceId: "ws-1", planCode: "growth" }]])
        expect(billing.orderPlan).not.toHaveBeenCalled()
        expect(billing.renew).not.toHaveBeenCalled()
        expect(credits.topup).not.toHaveBeenCalled()
        expectAnswered(em)
    })

    it("writes the stable refusal code of a billing domain error", async () => {
        const em = mockEntityManager({
            query: [
                [SELECT_REQUEST, [REQUEST]],
                [MARK_REQUEST_FAILED, []],
            ],
        })
        const { requests, billing } = await build(em)
        billing.orderPlan.mockRejectedValue(new BillingError({ code: BillingErrorCode.Forbidden }))

        await expect(requests.answer(PAYLOAD)).resolves.toBe("failed")

        expect(em.query).toHaveBeenCalledTimes(2)
        expect(em.query).toHaveBeenNthCalledWith(2, MARK_REQUEST_FAILED, ["request-1", "BILLING_FORBIDDEN"])
    })
})

describe("PaymentOrderRequestsService", () => {
    it("writes the stable refusal code of a credits domain error", async () => {
        const em = mockEntityManager({
            query: [
                [SELECT_REQUEST, [{ ...REQUEST, kind: "topup", target: "missing-pack" }]],
                [MARK_REQUEST_FAILED, []],
            ],
        })
        const { requests, credits } = await build(em)
        credits.topup.mockRejectedValue(new CreditsError({ code: CreditsErrorCode.PackNotFound }))

        await expect(requests.answer(PAYLOAD)).resolves.toBe("failed")

        expect(em.query).toHaveBeenCalledTimes(2)
        expect(em.query).toHaveBeenNthCalledWith(2, MARK_REQUEST_FAILED, ["request-1", "CREDITS_PACK_NOT_FOUND"])
    })

    it("rethrows an infrastructure failure while placing the order for retry", async () => {
        const em = mockEntityManager({ query: [SELECT_REQUEST, [REQUEST]] })
        const { requests, billing } = await build(em)
        const cause = new Error("order storage unavailable")
        billing.orderPlan.mockRejectedValue(cause)

        await expect(requests.answer(PAYLOAD)).rejects.toBe(cause)

        expect(em.query.mock.calls).toEqual([[SELECT_REQUEST, ["request-1", "ws-1"]]])
    })

    it("rethrows a request lookup failure for retry", async () => {
        const em = mockEntityManager({})
        const cause = new Error("request storage unavailable")
        em.query.mockRejectedValue(cause)
        const { requests, billing } = await build(em)

        await expect(requests.answer(PAYLOAD)).rejects.toBe(cause)

        expect(em.query.mock.calls).toEqual([[SELECT_REQUEST, ["request-1", "ws-1"]]])
        expect(billing.orderPlan).not.toHaveBeenCalled()
    })

    it("rethrows a failure to record the completed request for retry", async () => {
        const em = mockEntityManager({
            query: [
                [SELECT_REQUEST, [REQUEST]],
                [MARK_REQUEST_DONE, []],
            ],
        })
        const cause = new Error("answer storage unavailable")
        em.query.mockResolvedValueOnce([REQUEST]).mockRejectedValueOnce(cause)
        const { requests } = await build(em)

        await expect(requests.answer(PAYLOAD)).rejects.toBe(cause)

        expectAnswered(em)
    })

    it("rethrows a failure to record a domain refusal for retry", async () => {
        const em = mockEntityManager({})
        const cause = new Error("refusal storage unavailable")
        em.query.mockResolvedValueOnce([REQUEST]).mockRejectedValueOnce(cause)
        const { requests, billing } = await build(em)
        billing.orderPlan.mockRejectedValue(new BillingError({ code: BillingErrorCode.Forbidden }))

        await expect(requests.answer(PAYLOAD)).rejects.toBe(cause)

        expect(em.query).toHaveBeenCalledTimes(2)
        expect(em.query).toHaveBeenNthCalledWith(2, MARK_REQUEST_FAILED, ["request-1", "BILLING_FORBIDDEN"])
    })
})
