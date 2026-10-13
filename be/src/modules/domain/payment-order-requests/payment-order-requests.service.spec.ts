import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { BillingService } from "@modules/domain/billing"
import type { PayableOrder } from "@modules/domain/billing"
import { BillingError, BillingErrorCode } from "@modules/domain/billing/errors/billing.error"
import { CreditsService } from "@modules/domain/credits"
import { CreditsError, CreditsErrorCode } from "@modules/domain/credits/errors/credits.error"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { PaymentOrderRequestsService } from "./payment-order-requests.service"
import type { RequestRow } from "./persistence/payment-order-requests.rows"
import { MARK_REQUEST_DONE, MARK_REQUEST_FAILED, SELECT_REQUEST } from "./persistence/payment-order-requests.sql"

const PAYLOAD = { requestId: "request-1", workspaceId: "ws-1" }
const REQUEST: RequestRow = {
    id: "request-1",
    workspace_id: "ws-1",
    requested_by: "person-1",
    kind: "plan",
    target: "starter",
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

const pending = (request: RequestRow = REQUEST) =>
    mockEntityManager({
        query: [
            [SELECT_REQUEST, [request]],
            [MARK_REQUEST_DONE, []],
        ],
    })

const expectAnswered = (entityManager: MockEntityManager) => {
    expect(entityManager.query).toHaveBeenCalledTimes(2)
    expect(entityManager.query).toHaveBeenNthCalledWith(1, SELECT_REQUEST, ["request-1", "ws-1"])
    expect(entityManager.query).toHaveBeenNthCalledWith(2, MARK_REQUEST_DONE, ["request-1", "order-1"])
}

describe("PaymentOrderRequestsService", () => {
    it("ignores a payload from another job without reading the database", async () => {
        const em = mockEntityManager()
        const { requests, billing, credits } = await build(em)

        await expect(requests.answer({ requestId: "request-1" })).resolves.toBe("ignored")

        expect(em.query).not.toHaveBeenCalled()
        expect(billing.orderPlan).not.toHaveBeenCalled()
        expect(billing.renew).not.toHaveBeenCalled()
        expect(credits.topup).not.toHaveBeenCalled()
        expect(credits.upgrade).not.toHaveBeenCalled()
    })

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
        const em = pending()
        const { requests, billing, credits } = await build(em)

        await expect(requests.answer({ ...PAYLOAD, requestedBy: "other-person", target: "other-plan" })).resolves.toBe(
            "ordered",
        )

        expect(billing.orderPlan.mock.calls).toEqual([["person-1", { workspaceId: "ws-1", planCode: "starter" }]])
        expect(billing.renew).not.toHaveBeenCalled()
        expect(credits.topup).not.toHaveBeenCalled()
        expect(credits.upgrade).not.toHaveBeenCalled()
        expectAnswered(em)
    })

    it("renews the workspace without a target", async () => {
        const em = pending({ ...REQUEST, kind: "renew", target: null })
        const { requests, billing, credits } = await build(em)

        await expect(requests.answer(PAYLOAD)).resolves.toBe("ordered")

        expect(billing.renew.mock.calls).toEqual([["person-1", { workspaceId: "ws-1" }]])
        expect(billing.orderPlan).not.toHaveBeenCalled()
        expect(credits.topup).not.toHaveBeenCalled()
        expect(credits.upgrade).not.toHaveBeenCalled()
        expectAnswered(em)
    })

    it("tops up the pack from the database", async () => {
        const em = pending({ ...REQUEST, kind: "topup", target: "credits_1000" })
        const { requests, billing, credits } = await build(em)

        await expect(requests.answer(PAYLOAD)).resolves.toBe("ordered")

        expect(credits.topup.mock.calls).toEqual([["person-1", { workspaceId: "ws-1", packCode: "credits_1000" }]])
        expect(billing.orderPlan).not.toHaveBeenCalled()
        expect(billing.renew).not.toHaveBeenCalled()
        expect(credits.upgrade).not.toHaveBeenCalled()
        expectAnswered(em)
    })

    it("answers an upgrade with the id of its payable order", async () => {
        const em = pending({ ...REQUEST, kind: "upgrade", target: "growth" })
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
        const em = mockEntityManager()
        const cause = new Error("request storage unavailable")
        em.query.mockRejectedValue(cause)
        const { requests, billing } = await build(em)

        await expect(requests.answer(PAYLOAD)).rejects.toBe(cause)

        expect(em.query.mock.calls).toEqual([[SELECT_REQUEST, ["request-1", "ws-1"]]])
        expect(billing.orderPlan).not.toHaveBeenCalled()
    })

    it("rethrows a failure to record the completed request for retry", async () => {
        const em = pending()
        const cause = new Error("answer storage unavailable")
        em.query.mockResolvedValueOnce([REQUEST]).mockRejectedValueOnce(cause)
        const { requests } = await build(em)

        await expect(requests.answer(PAYLOAD)).rejects.toBe(cause)

        expectAnswered(em)
    })

    it("rethrows a failure to record a domain refusal for retry", async () => {
        const em = mockEntityManager()
        const cause = new Error("refusal storage unavailable")
        em.query.mockResolvedValueOnce([REQUEST]).mockRejectedValueOnce(cause)
        const { requests, billing } = await build(em)
        billing.orderPlan.mockRejectedValue(new BillingError({ code: BillingErrorCode.Forbidden }))

        await expect(requests.answer(PAYLOAD)).rejects.toBe(cause)

        expect(em.query).toHaveBeenCalledTimes(2)
        expect(em.query).toHaveBeenNthCalledWith(2, MARK_REQUEST_FAILED, ["request-1", "BILLING_FORBIDDEN"])
    })
})
