import type * as SubjectModule from "./payment-order-requests.policy"
import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import { PaymentOrderRequestsError, PaymentOrderRequestsErrorCode } from "./errors/payment-order-requests.error"
import type { PaymentOrderRequestParams } from "./payment-order-requests.contracts"
import { selectionOf, targetOf, toRequestStatus } from "./payment-order-requests.policy"

/** A partial-object matcher, typed `unknown` so it flows into any slot. */
const objectLike = (shape: Record<string, unknown>): unknown => expect.objectContaining(shape)

/** What `run` throws, read as `unknown`; the matcher then judges its fields. */
const thrownBy = (run: () => unknown): unknown => {
    try {
        run()
    } catch (error) {
        return error
    }
    return undefined
}

const SUBJECT = Symbol("payment-order-requests.policy")
type Subject = Pick<typeof SubjectModule, "targetOf" | "selectionOf" | "toRequestStatus">

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { targetOf, selectionOf, toRequestStatus } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const paramsOf = builder<PaymentOrderRequestParams>({ workspaceId: "workspace-1", kind: "plan", target: "starter" })

const expectInvalid = (operation: () => unknown) => {
    expect(operation).toThrow(PaymentOrderRequestsError)
    expect(thrownBy(operation)).toEqual(objectLike({ code: PaymentOrderRequestsErrorCode.Invalid }))
}

describe("targetOf", () => {
    it.each([
        { kind: "plan", target: "a" },
        { kind: "topup", target: "credits_1000" },
        { kind: "upgrade", target: "growth-2" },
        { kind: "credit_pack", target: "a".repeat(40) },
    ] as const)("accepts the bounded target of $kind", async ({ kind, target }) => {
        const subject = await buildSubject()

        expect(subject.targetOf(paramsOf({ kind, target }))).toBe(target)
    })

    it("ignores even an invalid target on a renewal", async () => {
        const subject = await buildSubject()

        expect(subject.targetOf(paramsOf({ kind: "renew", target: "INVALID target" }))).toBeNull()
    })

    it("refuses an unrecognized operation", async () => {
        const subject = await buildSubject()

        const params = paramsOf()
        Reflect.set(params, "kind", "cancel")

        expectInvalid(() => subject.targetOf(params))
    })

    it.each([undefined, null, "", "a".repeat(41), "Starter", "starter plan", "starter/plan", 100])(
        "refuses an absent or malformed target: %p",
        async (target) => {
            const subject = await buildSubject()

            const params = paramsOf()
            Reflect.set(params, "target", target)

            expectInvalid(() => subject.targetOf(params))
        },
    )
})

describe("selectionOf", () => {
    it.each(["renew", "topup", "upgrade", "credit_pack"] as const)("clears plan selection for %s", async (kind) => {
        const subject = await buildSubject()

        expect(subject.selectionOf(paramsOf({ kind, cycle: "annual", tierCredits: 100, seats: 3 }))).toEqual({
            cycle: null,
            tierCredits: null,
            seats: null,
        })
    })

    it("defaults missing plan selection to a monthly cycle with no tier or seats", async () => {
        const subject = await buildSubject()

        expect(subject.selectionOf(paramsOf())).toEqual({ cycle: "monthly", tierCredits: null, seats: null })
    })

    it("defaults explicitly null plan selection to a monthly cycle", async () => {
        const subject = await buildSubject()

        expect(subject.selectionOf(paramsOf({ cycle: null, tierCredits: null, seats: null }))).toEqual({
            cycle: "monthly",
            tierCredits: null,
            seats: null,
        })
    })

    it.each([
        { cycle: "monthly", tierCredits: 1, seats: 1 },
        { cycle: "annual", tierCredits: 5000, seats: 1000 },
    ] as const)("accepts a bounded plan selection: $cycle, $tierCredits, $seats", async (selection) => {
        const subject = await buildSubject()

        expect(subject.selectionOf(paramsOf(selection))).toEqual(selection)
    })

    it.each([
        { field: "cycle", value: "weekly" },
        { field: "tierCredits", value: 1.5 },
        { field: "tierCredits", value: 0 },
        { field: "tierCredits", value: -1 },
        { field: "seats", value: 1.5 },
        { field: "seats", value: 0 },
        { field: "seats", value: 1001 },
    ])("refuses an invalid plan selection: $field = $value", async ({ field, value }) => {
        const subject = await buildSubject()

        const params = paramsOf({ cycle: "annual", tierCredits: 100, seats: 2 })
        Reflect.set(params, field, value)

        expectInvalid(() => subject.selectionOf(params))
    })
})

describe("toRequestStatus", () => {
    it.each([
        { status: "pending", order_id: null, fault: null, expected: "queued" },
        { status: "done", order_id: "order-1", fault: null, expected: "succeeded" },
        { status: "failed", order_id: null, fault: "BILLING_FORBIDDEN", expected: "failed" },
    ] as const)("presents a $status request", async ({ status, order_id, fault, expected }) => {
        const subject = await buildSubject()

        expect(subject.toRequestStatus({ id: "request-1", status, orderId: order_id, fault })).toEqual({
            id: "request-1",
            status: expected,
            resultId: order_id,
            errorCode: fault,
        })
    })
})
