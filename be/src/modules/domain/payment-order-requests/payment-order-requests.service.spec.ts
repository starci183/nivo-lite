import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { ANY_FUNCTION } from "@tests/fixtures/builders/fake-query-builder.builder"
import { PAYABLE, PAYLOAD, REQUEST, answered, entityOf } from "@tests/fixtures/builders/payment-order-requests.builder"
import { BillingError, BillingErrorCode, BillingService } from "@modules/domain/billing"
import { CreditsError, CreditsErrorCode, CreditsService } from "@modules/domain/credits"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { PaymentOrderRequestsErrorCode } from "./errors/payment-order-requests.error"
import { PAYMENT_ORDER_REQUEST_QUEUE } from "./payment-order-requests.contracts"
import type { PaymentOrderRequestParams, PaymentOrderRequestStatus } from "./payment-order-requests.contracts"
import { PaymentOrderRequestsService } from "./payment-order-requests.service"
import { PaymentOrderRequestEntity } from "./persistence/entities"

/** The statement `callDbFunction` runs to enqueue the fenced job. */
const ENQUEUE_REQUEST = "SELECT * FROM public.job_enqueue($1, $2, $3, $4, $5)"

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

/** Asserts none of the given service doubles ran, for the order paths a request did not take. */
const expectNotCalled = (...doubles: ReadonlyArray<object>): void => {
    for (const double of doubles) expect(double).not.toHaveBeenCalled()
}

/** The arguments of the update that records a refused request with its stable fault code. */
const failedAnswer = (fault: string) =>
    [
        PaymentOrderRequestEntity,
        { id: "request-1", status: "pending" },
        { status: "failed", fault, answeredAt: ANY_FUNCTION },
    ] as const

const expectAnswered = (entityManager: MockEntityManager) => {
    expect(entityManager.findOne).toHaveBeenCalledTimes(1)
    expect(entityManager.findOne).toHaveBeenCalledWith(PaymentOrderRequestEntity, {
        where: { id: "request-1", workspaceId: "ws-1" },
    })
    expect(entityManager.update).toHaveBeenCalledTimes(1)
    expect(entityManager.update).toHaveBeenCalledWith(
        PaymentOrderRequestEntity,
        { id: "request-1", status: "pending" },
        { status: "done", orderId: "order-1", answeredAt: ANY_FUNCTION },
    )
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
                insert: [PaymentOrderRequestEntity, { identifiers: [{ id: "request-1" }] }],
                query: [ENQUEUE_REQUEST, []],
            })
            const tx = fakeTransaction(em)
            const { requests, billing, credits } = await build(em)
            credits.listPacks.mockResolvedValue([{ code: "credits_1000", credits: 1000, priceVnd: 299000, sort: 1 }])

            await expect(requests.request("person-1", params)).resolves.toEqual({ id: "request-1", status: "queued" })

            expect(billing.requireManager.mock.calls).toEqual([["person-1", "ws-1"]])
            expect(billing.requirePlan.mock.calls).toEqual(plan === null ? [] : [[plan]])
            expect(credits.listPacks).toHaveBeenCalledTimes(packs ? 1 : 0)
            const [kind, target, cycle, tierCredits, seats] = values
            expect(em.insert).toHaveBeenCalledWith(PaymentOrderRequestEntity, {
                workspaceId: "ws-1",
                requestedBy: "person-1",
                kind,
                target,
                cycle,
                tierCredits,
                seats,
            })
            expect(em.query.mock.calls).toEqual([
                [
                    ENQUEUE_REQUEST,
                    [
                        "ws-1",
                        PAYMENT_ORDER_REQUEST_QUEUE,
                        PAYMENT_ORDER_REQUEST_QUEUE,
                        { workspaceId: "ws-1", requestId: "request-1" },
                        "payment-order-request:request-1",
                    ],
                ],
            ])
            expect(tx.outcomes).toEqual(["commit"])
        },
    )
})

/** A stored status as the specs write it. */
interface StoredStatus {
    readonly id: string
    readonly status: PaymentOrderRequestEntity["status"]
    readonly order_id: string | null
    readonly fault: string | null
}

describe("PaymentOrderRequestsService", () => {
    it("rolls back without queuing when insertion does not produce a request id", async () => {
        const em = mockEntityManager({ insert: [PaymentOrderRequestEntity, { identifiers: [] }] })
        const tx = fakeTransaction(em)
        const { requests } = await build(em)

        await expect(requests.request("person-1", { workspaceId: "ws-1", kind: "renew" })).rejects.toMatchObject({
            code: PaymentOrderRequestsErrorCode.NotCreated,
        })

        expect(em.insert).toHaveBeenCalledTimes(1)
        expect(em.query).not.toHaveBeenCalled()
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
        expectNotCalled(em.transaction, em.query)
    })

    it.each<{ rows: Array<StoredStatus>; expected: PaymentOrderRequestStatus | null }>([
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
        const em = mockEntityManager({
            findOne: [
                PaymentOrderRequestEntity,
                rows[0] === undefined
                    ? null
                    : Object.assign(new PaymentOrderRequestEntity(), {
                          id: rows[0].id,
                          status: rows[0].status,
                          orderId: rows[0].order_id,
                          fault: rows[0].fault,
                      }),
            ],
        })
        const { requests, billing } = await build(em)

        await expect(requests.status("person-1", "ws-1", "request-1")).resolves.toEqual(expected)

        expect(billing.requireManager.mock.calls).toEqual([["person-1", "ws-1"]])
        expect(em.findOne).toHaveBeenCalledWith(PaymentOrderRequestEntity, {
            select: { id: true, status: true, orderId: true, fault: true },
            where: { id: "request-1", workspaceId: "ws-1", requestedBy: "person-1" },
        })
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
        const em = mockEntityManager({ update: [PaymentOrderRequestEntity, { affected: 1 }] })
        const { requests } = await build(em)

        await expect(requests.fail(PAYLOAD, cause)).resolves.toBeUndefined()

        expect(em.update).toHaveBeenCalledWith(
            PaymentOrderRequestEntity,
            { id: "request-1", status: "pending", workspaceId: "ws-1" },
            { status: "failed", fault: code, answeredAt: ANY_FUNCTION },
        )
    })

    it("uses the stored annual selection when answering a plan request", async () => {
        const em = mockEntityManager(answered({ ...REQUEST, cycle: "annual", tier_credits: 500, seats: 3 }))
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
        const em = mockEntityManager(answered({ ...REQUEST, kind: "credit_pack", target: "500" }))
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

        expectNotCalled(em.query, billing.orderPlan, billing.renew, credits.topup, credits.upgrade)
    })
})

describe("PaymentOrderRequestsService", () => {
    it.each([
        { rows: [] },
        { rows: [{ ...REQUEST, status: "done" as const }] },
        { rows: [{ ...REQUEST, status: "failed" as const }] },
    ])("ignores a missing or already answered request: $rows", async ({ rows }) => {
        const em = mockEntityManager({
            findOne: [PaymentOrderRequestEntity, rows[0] === undefined ? null : entityOf(rows[0])],
        })
        const { requests, billing, credits } = await build(em)

        await expect(requests.answer(PAYLOAD)).resolves.toBe("ignored")

        expect(em.findOne).toHaveBeenCalledTimes(1)
        expectNotCalled(em.update, billing.orderPlan, billing.renew, credits.topup, credits.upgrade)
    })

    it("orders the plan using the requester and target from the database", async () => {
        const em = mockEntityManager(answered())
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
        expectNotCalled(billing.renew, credits.topup, credits.upgrade)
        expectAnswered(em)
    })

    it("renews the workspace without a target", async () => {
        const em = mockEntityManager(answered({ ...REQUEST, kind: "renew", target: null }))
        const { requests, billing, credits } = await build(em)

        await expect(requests.answer(PAYLOAD)).resolves.toBe("ordered")

        expect(billing.renew.mock.calls).toEqual([["person-1", { workspaceId: "ws-1" }]])
        expectNotCalled(billing.orderPlan, credits.topup, credits.upgrade)
        expectAnswered(em)
    })
})

describe("PaymentOrderRequestsService", () => {
    it("tops up the pack from the database", async () => {
        const em = mockEntityManager(answered({ ...REQUEST, kind: "topup", target: "credits_1000" }))
        const { requests, billing, credits } = await build(em)

        await expect(requests.answer(PAYLOAD)).resolves.toBe("ordered")

        expect(credits.topup.mock.calls).toEqual([["person-1", { workspaceId: "ws-1", packCode: "credits_1000" }]])
        expectNotCalled(billing.orderPlan, billing.renew, credits.upgrade)
        expectAnswered(em)
    })

    it("answers an upgrade with the id of its payable order", async () => {
        const em = mockEntityManager(answered({ ...REQUEST, kind: "upgrade", target: "growth" }))
        const { requests, billing, credits } = await build(em)

        await expect(requests.answer(PAYLOAD)).resolves.toBe("ordered")

        expect(credits.upgrade.mock.calls).toEqual([["person-1", { workspaceId: "ws-1", planCode: "growth" }]])
        expectNotCalled(billing.orderPlan, billing.renew, credits.topup)
        expectAnswered(em)
    })

    it("writes the stable refusal code of a billing domain error", async () => {
        const em = mockEntityManager(answered())
        const { requests, billing } = await build(em)
        billing.orderPlan.mockRejectedValue(new BillingError({ code: BillingErrorCode.Forbidden }))

        await expect(requests.answer(PAYLOAD)).resolves.toBe("failed")

        expect(em.update).toHaveBeenCalledTimes(1)
        expect(em.update).toHaveBeenCalledWith(...failedAnswer("BILLING_FORBIDDEN"))
    })
})

describe("PaymentOrderRequestsService refusals", () => {
    it("writes the stable refusal code of a credits domain error", async () => {
        const em = mockEntityManager(answered({ ...REQUEST, kind: "topup", target: "missing-pack" }))
        const { requests, credits } = await build(em)
        credits.topup.mockRejectedValue(new CreditsError({ code: CreditsErrorCode.PackNotFound }))

        await expect(requests.answer(PAYLOAD)).resolves.toBe("failed")

        expect(em.update).toHaveBeenCalledWith(...failedAnswer("CREDITS_PACK_NOT_FOUND"))
    })

    it("rethrows an infrastructure failure while placing the order for retry", async () => {
        const em = mockEntityManager({ findOne: [PaymentOrderRequestEntity, entityOf(REQUEST)] })
        const { requests, billing } = await build(em)
        const cause = new Error("order storage unavailable")
        billing.orderPlan.mockRejectedValue(cause)

        await expect(requests.answer(PAYLOAD)).rejects.toBe(cause)

        expect(em.update).not.toHaveBeenCalled()
    })

    it("rethrows a request lookup failure for retry", async () => {
        const em = mockEntityManager({})
        const cause = new Error("request storage unavailable")
        em.findOne.mockRejectedValue(cause)
        const { requests, billing } = await build(em)

        await expect(requests.answer(PAYLOAD)).rejects.toBe(cause)

        expect(em.findOne).toHaveBeenCalledTimes(1)
        expect(billing.orderPlan).not.toHaveBeenCalled()
    })

    it("rethrows a failure to record the completed request for retry", async () => {
        const em = mockEntityManager(answered())
        const cause = new Error("answer storage unavailable")
        em.update.mockRejectedValueOnce(cause)
        const { requests } = await build(em)

        await expect(requests.answer(PAYLOAD)).rejects.toBe(cause)

        expectAnswered(em)
    })

    it("rethrows a failure to record a domain refusal for retry", async () => {
        const em = mockEntityManager({ findOne: [PaymentOrderRequestEntity, entityOf(REQUEST)] })
        const cause = new Error("refusal storage unavailable")
        em.update.mockRejectedValueOnce(cause)
        const { requests, billing } = await build(em)
        billing.orderPlan.mockRejectedValue(new BillingError({ code: BillingErrorCode.Forbidden }))

        await expect(requests.answer(PAYLOAD)).rejects.toBe(cause)

        expect(em.update).toHaveBeenCalledTimes(1)
        expect(em.update).toHaveBeenCalledWith(...failedAnswer("BILLING_FORBIDDEN"))
    })
})
