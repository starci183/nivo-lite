import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { PaymentProofService } from "@modules/domain/billing"
import type { SepayDelivery } from "@modules/domain/billing"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import {
    COMPLETE_SEPAY_TRANSACTION,
    INSERT_SEPAY_TRANSACTION,
    SETTLE_PAYMENT_ORDER,
    UPDATE_SEPAY_RESULT,
} from "./persistence/sepay-transactions.sql"
import { SepayTransactionsService } from "./sepay-transactions.service"

const AUTHORIZATION = "Apikey billing-key"

const credit = (over: Record<string, unknown> = {}): SepayDelivery => ({
    authorization: AUTHORIZATION,
    rawBody: Buffer.from(
        JSON.stringify({
            id: 9001,
            gateway: "MBBank",
            transferType: "in",
            transferAmount: 990000,
            content: "nivo 8f3k2 chuyen tien",
            description: "BankAPINotify NIVO8F3K2",
            code: null,
            ...over,
        }),
    ),
})

const build = async (stubs: ReadonlyArray<readonly [string, unknown]>) => {
    const tx = fakeTransaction(mockEntityManager({ query: stubs }))
    const proof = mock<PaymentProofService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            SepayTransactionsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: PaymentProofService, useValue: proof },
        ],
    }).compile()
    return { settlement: moduleRef.get(SepayTransactionsService), tx, proof }
}

const CLAIMED = [INSERT_SEPAY_TRANSACTION, [{ id: "row-1" }]] as const
const COMPLETED = [COMPLETE_SEPAY_TRANSACTION, [{ id: "row-1" }]] as const

describe("SepayTransactionsService", () => {
    describe("acceptSepayDelivery", () => {
        it("proves the key, claims the transaction, settles the order the transfer names and completes it in one transaction", async () => {
            const { settlement, tx, proof } = await build([
                CLAIMED,
                [SETTLE_PAYMENT_ORDER, [{ outcome: "paid" }]],
                [UPDATE_SEPAY_RESULT, []],
                COMPLETED,
            ])

            await settlement.acceptSepayDelivery(credit())

            expect(proof.verifyBillingKey).toHaveBeenCalledWith(AUTHORIZATION)
            expect(tx.commits).toBe(1)
            expect(tx.em.query).toHaveBeenCalledWith(INSERT_SEPAY_TRANSACTION, [
                "sepay",
                "9001",
                expect.stringContaining('"id":9001'),
            ])
            expect(tx.em.query).toHaveBeenCalledWith(SETTLE_PAYMENT_ORDER, ["NIVO8F3K2", 990000, 9001])
            expect(tx.em.query).toHaveBeenCalledWith(UPDATE_SEPAY_RESULT, [
                9001,
                "paid",
                990000,
                "nivo 8f3k2 chuyen tien",
            ])
            expect(tx.em.query).toHaveBeenCalledWith(COMPLETE_SEPAY_TRANSACTION, ["row-1"])
        })

        it("touches nothing when the key is refused", async () => {
            const { settlement, tx, proof } = await build([])
            const refusal = "refused"
            proof.verifyBillingKey.mockImplementation(() => {
                throw refusal
            })

            await expect(settlement.acceptSepayDelivery(credit())).rejects.toBe(refusal)

            expect(tx.outcomes).toEqual([])
            expect(tx.em.query).not.toHaveBeenCalled()
        })

        it("acknowledges a repeated transaction id without settling the order a second time", async () => {
            const { settlement, tx } = await build([[INSERT_SEPAY_TRANSACTION, []]])

            await settlement.acceptSepayDelivery(credit())

            expect(tx.commits).toBe(1)
            expect(tx.em.query).toHaveBeenCalledTimes(1)
            expect(tx.em.query).not.toHaveBeenCalledWith(SETTLE_PAYMENT_ORDER, expect.anything())
            expect(tx.em.query).not.toHaveBeenCalledWith(UPDATE_SEPAY_RESULT, expect.anything())
        })

        it("tries the next code in the transfer when the first names no order", async () => {
            const { settlement, tx } = await build([
                CLAIMED,
                [SETTLE_PAYMENT_ORDER, [{ outcome: "unmatched" }]],
                [SETTLE_PAYMENT_ORDER, [{ outcome: "underpaid" }]],
                [UPDATE_SEPAY_RESULT, []],
                COMPLETED,
            ])

            await settlement.acceptSepayDelivery(credit({ code: "NIVO23456" }))

            expect(tx.em.query).toHaveBeenCalledWith(SETTLE_PAYMENT_ORDER, ["NIVO23456", 990000, 9001])
            expect(tx.em.query).toHaveBeenCalledWith(SETTLE_PAYMENT_ORDER, ["NIVO8F3K2", 990000, 9001])
            expect(tx.em.query).toHaveBeenCalledWith(UPDATE_SEPAY_RESULT, [
                9001,
                "underpaid",
                990000,
                "nivo 8f3k2 chuyen tien",
            ])
        })

        it.each(["expired", "paid"] as const)("stores the %s outcome of the settlement", async (outcome) => {
            const { settlement, tx } = await build([
                CLAIMED,
                [SETTLE_PAYMENT_ORDER, [{ outcome }]],
                [UPDATE_SEPAY_RESULT, []],
                COMPLETED,
            ])

            await settlement.acceptSepayDelivery(credit())

            expect(tx.em.query).toHaveBeenCalledWith(UPDATE_SEPAY_RESULT, [9001, outcome, 990000, expect.any(String)])
        })

        it("lists a second transfer for an order that is already paid for review as unmatched", async () => {
            const { settlement, tx } = await build([
                CLAIMED,
                [SETTLE_PAYMENT_ORDER, [{ outcome: "ignored" }]],
                [UPDATE_SEPAY_RESULT, []],
                COMPLETED,
            ])

            await settlement.acceptSepayDelivery(credit())

            expect(tx.em.query).toHaveBeenCalledWith(UPDATE_SEPAY_RESULT, [
                9001,
                "unmatched",
                990000,
                expect.any(String),
            ])
        })

        it("stores a credit that names no order as unmatched, keeping the SePay code when there is no content", async () => {
            const { settlement, tx } = await build([CLAIMED, [UPDATE_SEPAY_RESULT, []], COMPLETED])

            await settlement.acceptSepayDelivery(credit({ content: null, description: null, code: "ABC" }))

            expect(tx.em.query).not.toHaveBeenCalledWith(SETTLE_PAYMENT_ORDER, expect.anything())
            expect(tx.em.query).toHaveBeenCalledWith(UPDATE_SEPAY_RESULT, [9001, "unmatched", 990000, "ABC"])
        })

        it("stores a missing content and code as null", async () => {
            const { settlement, tx } = await build([CLAIMED, [UPDATE_SEPAY_RESULT, []], COMPLETED])

            await settlement.acceptSepayDelivery(credit({ content: undefined, description: null }))

            expect(tx.em.query).toHaveBeenCalledWith(UPDATE_SEPAY_RESULT, [9001, "unmatched", 990000, null])
        })

        it("ignores an outgoing transfer without settling anything", async () => {
            const { settlement, tx } = await build([CLAIMED, [UPDATE_SEPAY_RESULT, []], COMPLETED])

            await settlement.acceptSepayDelivery(credit({ transferType: "out" }))

            expect(tx.em.query).not.toHaveBeenCalledWith(SETTLE_PAYMENT_ORDER, expect.anything())
            expect(tx.em.query).toHaveBeenCalledWith(UPDATE_SEPAY_RESULT, [9001, "ignored", 990000, expect.any(String)])
        })

        it("settles nothing for an amount it cannot read and stores no amount", async () => {
            const { settlement, tx } = await build([CLAIMED, [UPDATE_SEPAY_RESULT, []], COMPLETED])

            await settlement.acceptSepayDelivery(credit({ transferAmount: "lots" }))

            expect(tx.em.query).not.toHaveBeenCalledWith(SETTLE_PAYMENT_ORDER, expect.anything())
            expect(tx.em.query).toHaveBeenCalledWith(UPDATE_SEPAY_RESULT, [9001, "unmatched", null, expect.any(String)])
        })

        it("treats a settlement that answers no row as unmatched", async () => {
            const { settlement, tx } = await build([
                CLAIMED,
                [SETTLE_PAYMENT_ORDER, []],
                [UPDATE_SEPAY_RESULT, []],
                COMPLETED,
            ])

            await settlement.acceptSepayDelivery(credit())

            expect(tx.em.query).toHaveBeenCalledWith(UPDATE_SEPAY_RESULT, [
                9001,
                "unmatched",
                990000,
                expect.any(String),
            ])
        })

        it("rolls the claim back when the settlement fails, so the retry of SePay is processed", async () => {
            const { settlement, tx } = await build([CLAIMED])
            const failure = "refused"
            tx.em.query.mockResolvedValueOnce([{ id: "row-1" }]).mockRejectedValueOnce(failure)

            await expect(settlement.acceptSepayDelivery(credit())).rejects.toBe(failure)

            expect(tx.rollbacks).toBe(1)
            expect(tx.commits).toBe(0)
        })

        it.each([
            ["no body", undefined],
            ["a body that is not JSON", Buffer.from("not json")],
            ["a delivery without an id", Buffer.from('{"transferType":"in"}')],
        ])("refuses %s before opening a transaction", async (_name, rawBody) => {
            const { settlement, tx } = await build([])

            await expect(
                settlement.acceptSepayDelivery({ authorization: AUTHORIZATION, rawBody }),
            ).rejects.toMatchObject({
                code: "BILLING_WEBHOOK_INVALID",
            })
            expect(tx.outcomes).toEqual([])
        })
    })
})
