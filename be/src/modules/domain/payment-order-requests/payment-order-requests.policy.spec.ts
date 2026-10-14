import { builder } from "@starci/jest-preset"
import { PaymentOrderRequestsError, PaymentOrderRequestsErrorCode } from "./errors/payment-order-requests.error"
import type { PaymentOrderRequestParams } from "./payment-order-requests.contracts"
import { selectionOf, targetOf, toRequestStatus } from "./payment-order-requests.policy"

const paramsOf = builder<PaymentOrderRequestParams>({ workspaceId: "workspace-1", kind: "plan", target: "starter" })

const expectInvalid = (operation: () => unknown) => {
    expect(operation).toThrow(PaymentOrderRequestsError)
    expect(operation).toThrow(expect.objectContaining({ code: PaymentOrderRequestsErrorCode.Invalid }))
}

describe("targetOf", () => {
    it.each([
        { kind: "plan", target: "a" },
        { kind: "topup", target: "credits_1000" },
        { kind: "upgrade", target: "growth-2" },
        { kind: "credit_pack", target: "a".repeat(40) },
    ] as const)("accepts the bounded target of $kind", ({ kind, target }) => {
        expect(targetOf(paramsOf({ kind, target }))).toBe(target)
    })

    it("ignores even an invalid target on a renewal", () => {
        expect(targetOf(paramsOf({ kind: "renew", target: "INVALID target" }))).toBeNull()
    })

    it("refuses an unrecognized operation", () => {
        const params = paramsOf()
        Reflect.set(params, "kind", "cancel")

        expectInvalid(() => targetOf(params))
    })

    it.each([undefined, null, "", "a".repeat(41), "Starter", "starter plan", "starter/plan", 100])(
        "refuses an absent or malformed target: %p",
        (target) => {
            const params = paramsOf()
            Reflect.set(params, "target", target)

            expectInvalid(() => targetOf(params))
        },
    )
})

describe("selectionOf", () => {
    it.each(["renew", "topup", "upgrade", "credit_pack"] as const)("clears plan selection for %s", (kind) => {
        expect(selectionOf(paramsOf({ kind, cycle: "annual", tierCredits: 100, seats: 3 }))).toEqual({
            cycle: null,
            tierCredits: null,
            seats: null,
        })
    })

    it("defaults missing plan selection to a monthly cycle with no tier or seats", () => {
        expect(selectionOf(paramsOf())).toEqual({ cycle: "monthly", tierCredits: null, seats: null })
    })

    it("defaults explicitly null plan selection to a monthly cycle", () => {
        expect(selectionOf(paramsOf({ cycle: null, tierCredits: null, seats: null }))).toEqual({
            cycle: "monthly",
            tierCredits: null,
            seats: null,
        })
    })

    it.each([
        { cycle: "monthly", tierCredits: 1, seats: 1 },
        { cycle: "annual", tierCredits: 5000, seats: 1000 },
    ] as const)("accepts a bounded plan selection: $cycle, $tierCredits, $seats", (selection) => {
        expect(selectionOf(paramsOf(selection))).toEqual(selection)
    })

    it.each([
        { field: "cycle", value: "weekly" },
        { field: "tierCredits", value: 1.5 },
        { field: "tierCredits", value: 0 },
        { field: "tierCredits", value: -1 },
        { field: "seats", value: 1.5 },
        { field: "seats", value: 0 },
        { field: "seats", value: 1001 },
    ])("refuses an invalid plan selection: $field = $value", ({ field, value }) => {
        const params = paramsOf({ cycle: "annual", tierCredits: 100, seats: 2 })
        Reflect.set(params, field, value)

        expectInvalid(() => selectionOf(params))
    })
})

describe("toRequestStatus", () => {
    it.each([
        { status: "pending", order_id: null, fault: null, expected: "queued" },
        { status: "done", order_id: "order-1", fault: null, expected: "succeeded" },
        { status: "failed", order_id: null, fault: "BILLING_FORBIDDEN", expected: "failed" },
    ] as const)("presents a $status request", ({ status, order_id, fault, expected }) => {
        expect(toRequestStatus({ id: "request-1", status, order_id, fault })).toEqual({
            id: "request-1",
            status: expected,
            resultId: order_id,
            errorCode: fault,
        })
    })
})
