import type { ClaimedJob, JobClaims } from "@modules/platform/jobs"
import { Test } from "@nestjs/testing"
import { IsNull } from "typeorm"
import { evaluatedValues } from "@tests/fixtures/builders/evaluated-calls.builder"
import { fakeInbox, fakeTransaction, mock, mockEntityManager, recordingQueueOutbox } from "@starci/jest-preset"
import { BillingError, BillingErrorCode, PaymentProofService, parseJsonObject } from "@modules/domain/billing"
import type { SepayDelivery } from "@modules/domain/billing"
import { PaymentOrdersService } from "@modules/domain/payment-orders"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { INBOX } from "@modules/platform/inbox"
import { QUEUE_OUTBOX } from "@modules/platform/queue"
import { SEPAY_DELIVERY_QUEUE } from "@modules/queues/sepay-delivery"
import { fakeQueryBuilder } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { SepayTransactionEntity } from "./persistence/entities"
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

/** Marks the receipt as found and locked; the pending row itself is built from the delivery in `build`. */
const SETTLE_PAYMENT_ORDER = "SELECT * FROM public.settle_payment_order($1, $2, $3)"
const PENDING = "pending" as const
/** Marks the settlement result write and the completion write, which the entity API answers as updates. */
const UPDATE_SEPAY_RESULT = "update-result" as const
const COMPLETED = "completed" as const

type Stub = readonly [string, unknown] | typeof PENDING | typeof UPDATE_SEPAY_RESULT | typeof COMPLETED

const build = async (stubs: ReadonlyArray<Stub>, patch: Record<string, unknown> = {}) => {
    const settles = stubs.flatMap((stub) =>
        typeof stub === "string" || stub[0] !== SETTLE_PAYMENT_ORDER ? [] : [stub],
    )
    const pending = Object.assign(new SepayTransactionEntity(), {
        id: "row-1",
        payload: parseJsonObject(credit(patch).rawBody),
    })
    const found = stubs.includes(PENDING) ? pending : null
    const tx = fakeTransaction(
        settles.length > 0
            ? mockEntityManager({
                  findOne: [SepayTransactionEntity, found],
                  update: [SepayTransactionEntity, { affected: 1 }],
                  query: settles,
              })
            : mockEntityManager({
                  findOne: [SepayTransactionEntity, found],
                  update: [SepayTransactionEntity, { affected: 1 }],
              }),
    )
    const proof = mock<PaymentProofService>()
    const inbox = fakeInbox()
    const claims = mock<JobClaims>()
    claims.advance.mockResolvedValue(undefined)
    const outbox = recordingQueueOutbox()
    const orders = mock<PaymentOrdersService>({
        idsOfWorkspace: jest.fn((_workspaceId: string, ids: ReadonlyArray<string>) =>
            Promise.resolve(ids.filter((id) => id !== "foreign")),
        ),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            SepayTransactionsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: PaymentProofService, useValue: proof },
            { provide: INBOX, useValue: inbox },
            { provide: QUEUE_OUTBOX, useValue: outbox },
            { provide: PaymentOrdersService, useValue: orders },
        ],
    }).compile()
    return { settlement: moduleRef.get(SepayTransactionsService), tx, proof, inbox, outbox, claims, orders }
}

describe("SepayTransactionsService review", () => {
    describe("review", () => {
        it("reads nothing for no orders", async () => {
            const { settlement, tx } = await build([])

            await expect(settlement.review("ws-1", [])).resolves.toEqual([])
            expect(tx.em.query).not.toHaveBeenCalled()
        })

        it("reads nothing when none of the orders belongs to the workspace", async () => {
            const { settlement, tx } = await build([])

            await expect(settlement.review("ws-1", ["foreign"])).resolves.toEqual([])
            expect(tx.em.createQueryBuilder).not.toHaveBeenCalled()
        })

        it("maps the transfers of the workspace orders with an ISO receipt time", async () => {
            const { settlement, tx, orders } = await build([])
            const review = fakeQueryBuilder({
                getMany: [
                    Object.assign(new SepayTransactionEntity(), {
                        sepayId: 9001,
                        status: "underpaid",
                        transferAmount: 500000,
                        receivedAt: new Date("2026-10-13T09:00:00+07:00"),
                        content: null,
                    }),
                    Object.assign(new SepayTransactionEntity(), {
                        sepayId: 9002,
                        status: "unmatched",
                        transferAmount: null,
                        receivedAt: new Date("2026-10-13T08:00:00+07:00"),
                        content: "chuyen khoan",
                    }),
                ],
            })
            tx.em.createQueryBuilder.mockReturnValue(review.builder)

            await expect(settlement.review("ws-1", ["order-1"])).resolves.toEqual([
                {
                    id: 9001,
                    status: "underpaid",
                    transferAmount: 500000,
                    receivedAt: "2026-10-13T02:00:00.000Z",
                    content: null,
                },
                {
                    id: 9002,
                    status: "unmatched",
                    transferAmount: 0,
                    receivedAt: "2026-10-13T01:00:00.000Z",
                    content: "chuyen khoan",
                },
            ])
            expect(tx.em.createQueryBuilder).toHaveBeenCalledWith(SepayTransactionEntity, "t")
            expect(orders.idsOfWorkspace).toHaveBeenCalledWith("ws-1", ["order-1"])
            expect(review.callsOf("where")).toEqual([["t.matchedOrderId IN (:...ownedIds)", { ownedIds: ["order-1"] }]])
            expect(review.callsOf("andWhere")).toEqual([
                ["t.status IN (:...statuses)", { statuses: ["underpaid", "expired", "unmatched"] }],
            ])
            expect(review.callsOf("orderBy")).toEqual([["t.receivedAt", "DESC"]])
            expect(review.callsOf("limit")).toEqual([[50]])
        })
    })
})

describe("SepayTransactionsService verification", () => {
    describe("verifySepayDelivery", () => {
        it.each([AUTHORIZATION, undefined])(
            "delegates the exact authorization %j without reading data",
            async (authorization) => {
                const { settlement, tx, proof } = await build([])

                settlement.verifySepayDelivery(authorization)

                expect(proof.verifyBillingKey).toHaveBeenCalledTimes(1)
                expect(proof.verifyBillingKey).toHaveBeenCalledWith(authorization)
                expect(tx.outcomes).toEqual([])
                expect(tx.em.query).not.toHaveBeenCalled()
            },
        )

        it("propagates a refused key without reading data", async () => {
            const { settlement, tx, proof } = await build([])
            const failure = new BillingError({ code: BillingErrorCode.WebhookUnauthorized })
            proof.verifyBillingKey.mockImplementation(() => {
                throw failure
            })

            expect(() => settlement.verifySepayDelivery(AUTHORIZATION)).toThrow(failure)
            expect(tx.outcomes).toEqual([])
            expect(tx.em.query).not.toHaveBeenCalled()
        })
    })
})

describe("SepayTransactionsService", () => {
    describe("processRecordedDelivery", () => {
        it("proves and records the delivery, then settles and completes its queued receipt", async () => {
            const { settlement, tx, proof, inbox, outbox } = await build([
                PENDING,
                [SETTLE_PAYMENT_ORDER, [{ settle_payment_order: "paid" }]],
                UPDATE_SEPAY_RESULT,
                COMPLETED,
            ])

            await settlement.acceptSepayDelivery(credit())
            await settlement.processRecordedDelivery({ deliveryId: "9001" })
            expect(proof.verifyBillingKey).toHaveBeenCalledWith(AUTHORIZATION)
            expect(tx.commits).toBe(2)
            expect(inbox.claims).toEqual([{ source: "sepay", eventId: "9001" }])
            expect(outbox.jobs).toEqual([{ queue: SEPAY_DELIVERY_QUEUE, payload: { deliveryId: "9001" } }])
            expect(outbox.allInTransaction).toBe(true)
            expect(tx.em.query).toHaveBeenCalledWith(SETTLE_PAYMENT_ORDER, ["NIVO8F3K2", 990000, 9001])
            expect(tx.em.update).toHaveBeenCalledWith(
                SepayTransactionEntity,
                { sepayId: 9001 },
                { status: "paid", transferAmount: 990000, content: "nivo 8f3k2 chuyen tien" },
            )
            const completion = tx.em.update.mock.calls.find(([, where]) => Reflect.get(Object(where), "id") === "row-1")
            expect(evaluatedValues(completion?.[2])).toEqual({ processedAt: "now()" })
        })

        it("touches nothing when the delivery is refused at the door", async () => {
            const { settlement, tx, proof } = await build([])
            proof.verifyBillingKey.mockImplementation(() => {
                parseJsonObject(undefined)
            })

            await expect(settlement.acceptSepayDelivery(credit())).rejects.toMatchObject({
                code: "BILLING_WEBHOOK_INVALID",
            })

            expect(tx.outcomes).toEqual([])
            expect(tx.em.query).not.toHaveBeenCalled()
        })

        it("acknowledges a repeated transaction id without queueing or settling the order a second time", async () => {
            const { settlement, tx, inbox, outbox } = await build([])
            inbox.seen("sepay", "9001")

            await settlement.acceptSepayDelivery(credit())

            expect(tx.commits).toBe(1)
            expect(inbox.claims).toEqual([{ source: "sepay", eventId: "9001" }])
            expect(outbox.jobs).toEqual([])
            expect(tx.em.query).not.toHaveBeenCalledWith(SETTLE_PAYMENT_ORDER, expect.anything())
            expect(tx.em.update).not.toHaveBeenCalled()
        })

        it("tries the next code in the transfer when the first names no order", async () => {
            const { settlement, tx } = await build(
                [
                    PENDING,
                    [SETTLE_PAYMENT_ORDER, [{ settle_payment_order: "unmatched" }]],
                    [SETTLE_PAYMENT_ORDER, [{ settle_payment_order: "underpaid" }]],
                    UPDATE_SEPAY_RESULT,
                    COMPLETED,
                ],
                { code: "NIVO23456" },
            )

            await settlement.processRecordedDelivery({ deliveryId: "9001" })

            expect(tx.em.query).toHaveBeenCalledWith(SETTLE_PAYMENT_ORDER, ["NIVO23456", 990000, 9001])
            expect(tx.em.query).toHaveBeenCalledWith(SETTLE_PAYMENT_ORDER, ["NIVO8F3K2", 990000, 9001])
            expect(tx.em.update).toHaveBeenCalledWith(
                SepayTransactionEntity,
                { sepayId: 9001 },
                { status: "underpaid", transferAmount: 990000, content: "nivo 8f3k2 chuyen tien" },
            )
        })
    })
})

describe("SepayTransactionsService", () => {
    describe("processRecordedDelivery", () => {
        it.each(["expired", "paid"] as const)("stores the %s outcome of the settlement", async (outcome) => {
            const { settlement, tx } = await build([
                PENDING,
                [SETTLE_PAYMENT_ORDER, [{ settle_payment_order: outcome }]],
                UPDATE_SEPAY_RESULT,
                COMPLETED,
            ])

            await settlement.processRecordedDelivery({ deliveryId: "9001" })

            expect(tx.em.update).toHaveBeenCalledWith(
                SepayTransactionEntity,
                { sepayId: 9001 },
                { status: outcome, transferAmount: 990000, content: "nivo 8f3k2 chuyen tien" },
            )
        })

        it("lists a second transfer for an order that is already paid for review as unmatched", async () => {
            const { settlement, tx } = await build([
                PENDING,
                [SETTLE_PAYMENT_ORDER, [{ settle_payment_order: "ignored" }]],
                UPDATE_SEPAY_RESULT,
                COMPLETED,
            ])

            await settlement.processRecordedDelivery({ deliveryId: "9001" })

            expect(tx.em.update).toHaveBeenCalledWith(
                SepayTransactionEntity,
                { sepayId: 9001 },
                { status: "unmatched", transferAmount: 990000, content: "nivo 8f3k2 chuyen tien" },
            )
        })

        it("stores a credit that names no order as unmatched, keeping the SePay code when there is no content", async () => {
            const { settlement, tx } = await build([PENDING, UPDATE_SEPAY_RESULT, COMPLETED], {
                content: null,
                description: null,
                code: "ABC",
            })

            await settlement.processRecordedDelivery({ deliveryId: "9001" })

            expect(tx.em.query).not.toHaveBeenCalledWith(SETTLE_PAYMENT_ORDER, expect.anything())
            expect(tx.em.update).toHaveBeenCalledWith(
                SepayTransactionEntity,
                { sepayId: 9001 },
                { status: "unmatched", transferAmount: 990000, content: "ABC" },
            )
        })
    })
})

describe("SepayTransactionsService", () => {
    describe("unmatched and outgoing deliveries", () => {
        it("stores a missing content and code as null", async () => {
            const { settlement, tx } = await build([PENDING, UPDATE_SEPAY_RESULT, COMPLETED], {
                content: undefined,
                description: null,
            })

            await settlement.processRecordedDelivery({ deliveryId: "9001" })

            expect(tx.em.update).toHaveBeenCalledWith(
                SepayTransactionEntity,
                { sepayId: 9001 },
                { status: "unmatched", transferAmount: 990000, content: null },
            )
        })

        it("ignores an outgoing transfer without settling anything", async () => {
            const { settlement, tx } = await build([PENDING, UPDATE_SEPAY_RESULT, COMPLETED], {
                transferType: "out",
            })

            await settlement.processRecordedDelivery({ deliveryId: "9001" })

            expect(tx.em.query).not.toHaveBeenCalledWith(SETTLE_PAYMENT_ORDER, expect.anything())
            expect(tx.em.update).toHaveBeenCalledWith(
                SepayTransactionEntity,
                { sepayId: 9001 },
                { status: "ignored", transferAmount: 990000, content: "nivo 8f3k2 chuyen tien" },
            )
        })
    })
})

describe("SepayTransactionsService", () => {
    describe("processRecordedDelivery", () => {
        it("settles nothing for an amount it cannot read and stores no amount", async () => {
            const { settlement, tx } = await build([PENDING, UPDATE_SEPAY_RESULT, COMPLETED], {
                transferAmount: "lots",
            })

            await settlement.processRecordedDelivery({ deliveryId: "9001" })

            expect(tx.em.query).not.toHaveBeenCalledWith(SETTLE_PAYMENT_ORDER, expect.anything())
            expect(tx.em.update).toHaveBeenCalledWith(
                SepayTransactionEntity,
                { sepayId: 9001 },
                { status: "unmatched", transferAmount: null, content: "nivo 8f3k2 chuyen tien" },
            )
        })

        it("treats a settlement that answers no row as unmatched", async () => {
            const { settlement, tx } = await build([
                PENDING,
                [SETTLE_PAYMENT_ORDER, []],
                UPDATE_SEPAY_RESULT,
                COMPLETED,
            ])

            await settlement.processRecordedDelivery({ deliveryId: "9001" })

            expect(tx.em.update).toHaveBeenCalledWith(
                SepayTransactionEntity,
                { sepayId: 9001 },
                { status: "unmatched", transferAmount: 990000, content: "nivo 8f3k2 chuyen tien" },
            )
        })

        it("rolls receipt processing back when settlement fails, so the queued job can retry", async () => {
            const { settlement, tx } = await build([PENDING])
            const failure = "refused"
            tx.em.query.mockRejectedValueOnce(failure)

            await expect(settlement.processRecordedDelivery({ deliveryId: "9001" })).rejects.toBe(failure)

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

describe("SepayTransactionsService queued receipt retries", () => {
    it("does not settle a receipt already completed by a prior job", async () => {
        const { settlement, tx } = await build([])
        await settlement.processRecordedDelivery({ deliveryId: "9001" })
        expect(tx.em.findOne).toHaveBeenCalledWith(SepayTransactionEntity, {
            where: { sepayId: 9001, processedAt: IsNull() },
            lock: { mode: "pessimistic_write" },
        })
        expect(tx.em.update).not.toHaveBeenCalled()
        expect(tx.commits).toBe(1)
    })

    it("rolls intake back when writing the queued receipt fails", async () => {
        const { settlement, tx, outbox } = await build([])
        const failure = new Error("queue unavailable")
        outbox.failNext("write", failure)
        await expect(settlement.acceptSepayDelivery(credit())).rejects.toBe(failure)
        expect(tx.rollbacks).toBe(1)
        expect(tx.commits).toBe(0)
    })
})

const claimedJob: ClaimedJob = {
    jobId: "job-1",
    kind: SEPAY_DELIVERY_QUEUE,
    fencingToken: 3,
    currentStep: null,
    payload: { deliveryId: "delivery-1" },
}

describe("SepayTransactionsService claimed delivery", () => {
    it.each([undefined, null, 1, "id", {}, { deliveryId: "" }, { deliveryId: "   " }, { deliveryId: 1 }])(
        "discards malformed references before advancing the fence: %p",
        async (payload) => {
            const { settlement, claims, tx } = await build([])
            const job = { ...claimedJob }
            Reflect.set(job, "payload", payload)
            await settlement.processClaimedDelivery(job, claims)
            expect(claims.advance).not.toHaveBeenCalled()
            expect(tx.outcomes).toEqual([])
        },
    )
    it("advances the live fence before starting the receipt transaction", async () => {
        const { settlement, claims, tx } = await build([])
        claims.advance.mockImplementation(() => {
            expect(tx.outcomes).toEqual([])
            return Promise.resolve()
        })
        await settlement.processClaimedDelivery(claimedJob, claims)
        expect(claims.advance).toHaveBeenCalledWith({ jobId: "job-1", expectedFencingToken: 3, step: "sepay-delivery" })
        expect(tx.em.findOne).toHaveBeenCalledTimes(1)
        expect(tx.commits).toBe(1)
    })
    it("refuses stale fences before opening a receipt transaction", async () => {
        const { settlement, claims, tx } = await build([])
        const failure = new BillingError({ code: BillingErrorCode.WebhookInvalid })
        claims.advance.mockRejectedValue(failure)
        await expect(settlement.processClaimedDelivery(claimedJob, claims)).rejects.toBe(failure)
        expect(tx.outcomes).toEqual([])
    })
    it("propagates receipt failures for retry", async () => {
        const { settlement, tx, claims } = await build([])
        const failure = new BillingError({ code: BillingErrorCode.WebhookInvalid })
        tx.em.findOne.mockRejectedValue(failure)
        await expect(settlement.processClaimedDelivery(claimedJob, claims)).rejects.toBe(failure)
        expect(tx.rollbacks).toBe(1)
    })
})
