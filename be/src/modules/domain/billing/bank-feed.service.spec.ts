import { Test } from "@nestjs/testing"
import { FakeClock, fakeTransaction, mock, mockEntityManager, recordingQueueOutbox } from "@starci/jest-preset"
import { InboundEventsService } from "@modules/domain/inbound-events"
import { CLOCK } from "@modules/platform/clock"
import { Secret } from "@modules/platform/config"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { QUEUE_OUTBOX } from "@modules/platform/queue"
import { BANK_CREDIT_QUEUE, BankCreditQueue } from "@modules/queues/bank-credit"
import { BankFeedService } from "./bank-feed.service"
import { BILLING_OPTIONS } from "./billing.decorators"
import type { BillingOptions } from "./billing.options"
import type { PayosProof, ProvenDelivery } from "./billing.contracts"
import { BillingError, BillingErrorCode } from "./errors/billing.error"
import { PaymentProofService } from "./payment-proof.service"
import {
    MARK_CONNECTION_FED,
    SELECT_BOUND_ACCOUNTING_AGENT,
    SELECT_CONNECTION_STATE,
} from "./persistence/bank-feed.sql"

const NOW = "2026-10-12T10:00:00.000Z"
const OPTIONS: BillingOptions = {
    sepayApiKey: undefined,
    bankAccount: { account: "", bank: "", holder: "" },
    simulatedBank: { secret: new Secret("s"), workspaceId: "ws-sim" },
    channelTokenKey: undefined,
}
const CONNECTION = { connectionId: "conn-1", workspaceId: "ws-1" }

type Stub = readonly [string, unknown]
const STATE: Stub = [SELECT_CONNECTION_STATE, [{ name: "My Casso", environment: "live", status: "connected" }]]
const NO_STATE: Stub = [SELECT_CONNECTION_STATE, []]
const FED: Stub = [MARK_CONNECTION_FED, []]
const AGENT: Stub = [SELECT_BOUND_ACCOUNTING_AGENT, [{ id: "agent-1" }]]
const NO_AGENT: Stub = [SELECT_BOUND_ACCOUNTING_AGENT, []]

const build = async (stubs: ReadonlyArray<Stub>, options: BillingOptions = OPTIONS) => {
    const tx = fakeTransaction(mockEntityManager({ query: stubs }))
    const outbox = recordingQueueOutbox()
    const catalog = mock<MessageCatalog>()
    catalog.get.mockImplementation((key, params, locale) => `${locale}:${key}:${JSON.stringify(params)}`)
    const proof = mock<PaymentProofService>()
    const inbound = mock<InboundEventsService>()
    inbound.recordBankPayment.mockResolvedValue({ duplicate: false, inboundEventId: "event-1" })
    inbound.holdForOwnerCheck.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [
            BankFeedService,
            BankCreditQueue,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: BILLING_OPTIONS, useValue: options },
            { provide: PaymentProofService, useValue: proof },
            { provide: InboundEventsService, useValue: inbound },
            { provide: QUEUE_OUTBOX, useValue: outbox },
        ],
    }).compile()
    return { feed: moduleRef.get(BankFeedService), tx, outbox, proof, inbound }
}

const delivery = (body: ProvenDelivery["body"]): ProvenDelivery => ({ connection: CONNECTION, body })
const raw = (body: object): Buffer => Buffer.from(JSON.stringify(body))
const refusal = new BillingError({ code: BillingErrorCode.WebhookInvalid })

describe("BankFeedService", () => {
    describe("acceptSimulatedCredit", () => {
        const credit = { amount_vnd: 150000, content: "NIVO8F3K2", sender_name: "Anh Minh", event_id: "tx-1" }

        it("proves the secret, records the credit as simulated money and enqueues its job in the same transaction", async () => {
            const { feed, tx, outbox, proof, inbound } = await build([])

            await feed.acceptSimulatedCredit({ secret: "s", rawBody: raw(credit) })

            expect(proof.verifySimulatedBank).toHaveBeenCalledWith("s")
            expect(inbound.recordBankPayment).toHaveBeenCalledWith({
                manager: expect.anything(),
                workspaceId: "ws-sim",
                origin: "simulated",
                sender: "Anh Minh",
                body: 'vi:billing.bankEventBody:{"bank":"Vietcombank","content":"NIVO8F3K2"}',
                amountVnd: 150000,
                externalRef: "NIVO8F3K2",
                providerRef: "vietcombank:tx-1",
            })
            expect(outbox.jobsOf(BANK_CREDIT_QUEUE)).toEqual([
                {
                    queue: BANK_CREDIT_QUEUE,
                    payload: { workspaceId: "ws-sim", inboundEventId: "event-1", amountVnd: 150000 },
                },
            ])
            expect(outbox.allInTransaction).toBe(true)
            expect(tx.commits).toBe(1)
        })

        it("shows a dash for a credit without content and rounds the amount", async () => {
            const { feed, inbound } = await build([])

            await feed.acceptSimulatedCredit({ secret: "s", rawBody: raw({ amount_vnd: 1000.6, event_id: "tx-2" }) })

            expect(inbound.recordBankPayment).toHaveBeenCalledWith(
                expect.objectContaining({
                    amountVnd: 1001,
                    externalRef: null,
                    sender: null,
                    body: 'vi:billing.bankEventBody:{"bank":"Vietcombank","content":"—"}',
                }),
            )
        })

        it("enqueues nothing for a repeated credit", async () => {
            const { feed, inbound, outbox, tx } = await build([])
            inbound.recordBankPayment.mockResolvedValue({ duplicate: true, inboundEventId: "event-1" })

            await feed.acceptSimulatedCredit({ secret: "s", rawBody: raw(credit) })

            expect(outbox.jobs).toEqual([])
            expect(tx.commits).toBe(1)
        })

        it("rolls the event back when its job cannot be enqueued", async () => {
            const { feed, tx, outbox } = await build([])
            const failure = new BillingError({ code: BillingErrorCode.WebhookInvalid })
            outbox.failNext("write", failure)

            await expect(feed.acceptSimulatedCredit({ secret: "s", rawBody: raw(credit) })).rejects.toBe(failure)

            expect(tx.rollbacks).toBe(1)
        })

        it("opens no transaction when the proof refuses, the body is unusable or no workspace is configured", async () => {
            const refused = await build([])
            refused.proof.verifySimulatedBank.mockImplementation(() => {
                throw refusal
            })
            const bad = await build([])
            const off = await build([], {
                ...OPTIONS,
                simulatedBank: { secret: new Secret("s"), workspaceId: undefined },
            })

            await expect(refused.feed.acceptSimulatedCredit({ secret: "x", rawBody: raw(credit) })).rejects.toBe(
                refusal,
            )
            await expect(
                bad.feed.acceptSimulatedCredit({ secret: "s", rawBody: raw({ amount_vnd: 0 }) }),
            ).rejects.toMatchObject({
                code: BillingErrorCode.WebhookInvalid,
            })
            await expect(off.feed.acceptSimulatedCredit({ secret: "s", rawBody: raw(credit) })).rejects.toMatchObject({
                code: BillingErrorCode.FeedNotConfigured,
            })
            for (const { tx } of [refused, bad, off]) expect(tx.outcomes).toEqual([])
        })
    })

    describe("acceptCassoDelivery", () => {
        const tx1 = { id: 7, amount: 150000, description: " NIVO8F3K2 ", bankName: "ACB" }
        const cassoDelivery = { connectionId: "conn-1", rawBody: raw({}), signature: "sig", secureToken: undefined }

        it("proves the delivery, marks the connection and books each positive transaction with one job each", async () => {
            const { feed, tx, outbox, proof, inbound } = await build([STATE, FED, AGENT, STATE, FED, AGENT])
            proof.proveCasso.mockResolvedValue(
                delivery({ error: 0, data: [tx1, { ...tx1, id: 8, amount: 5000 }, { id: 9, amount: -1 }] }),
            )
            inbound.recordBankPayment
                .mockResolvedValueOnce({ duplicate: false, inboundEventId: "event-7" })
                .mockResolvedValueOnce({ duplicate: false, inboundEventId: "event-8" })

            await feed.acceptCassoDelivery(cassoDelivery)

            expect(proof.proveCasso).toHaveBeenCalledWith(cassoDelivery)
            expect(tx.em.query).toHaveBeenCalledWith(SELECT_CONNECTION_STATE, ["conn-1"])
            expect(tx.em.query).toHaveBeenCalledWith(MARK_CONNECTION_FED, [
                "conn-1",
                new Date(NOW),
                JSON.stringify({ amount: 150000, content: "NIVO8F3K2", at: NOW }),
            ])
            expect(inbound.recordBankPayment).toHaveBeenCalledWith(
                expect.objectContaining({
                    workspaceId: "ws-1",
                    origin: "live",
                    sender: null,
                    body: 'vi:billing.bankEventBody:{"bank":"My Casso","content":"NIVO8F3K2"}',
                    amountVnd: 150000,
                    providerRef: "casso:7",
                }),
            )
            expect(outbox.jobsOf(BANK_CREDIT_QUEUE).map((job) => job.payload)).toEqual([
                { workspaceId: "ws-1", inboundEventId: "event-7", amountVnd: 150000 },
                { workspaceId: "ws-1", inboundEventId: "event-8", amountVnd: 5000 },
            ])
            expect(tx.commits).toBe(2)
        })

        it("books nothing when the proof refuses, and acknowledges a delivery Casso marks as an error", async () => {
            const refused = await build([])
            refused.proof.proveCasso.mockRejectedValue(refusal)
            const errored = await build([])
            errored.proof.proveCasso.mockResolvedValue(delivery({ error: 3, data: tx1 }))

            await expect(refused.feed.acceptCassoDelivery(cassoDelivery)).rejects.toBe(refusal)
            await expect(errored.feed.acceptCassoDelivery(cassoDelivery)).resolves.toBeUndefined()
            for (const { tx, inbound } of [refused, errored]) {
                expect(tx.outcomes).toEqual([])
                expect(inbound.recordBankPayment).not.toHaveBeenCalled()
            }
        })

        it("only remembers the connection when no accounting agent is bound to it", async () => {
            const { feed, tx, outbox, proof, inbound } = await build([STATE, FED, NO_AGENT])
            proof.proveCasso.mockResolvedValue(delivery({ error: 0, data: tx1 }))

            await feed.acceptCassoDelivery(cassoDelivery)

            expect(tx.em.query).toHaveBeenCalledWith(MARK_CONNECTION_FED, expect.anything())
            expect(inbound.recordBankPayment).not.toHaveBeenCalled()
            expect(outbox.jobs).toEqual([])
        })

        it("stores a credit of a test connection as simulated money", async () => {
            const testState: Stub = [
                SELECT_CONNECTION_STATE,
                [{ name: "Casso test", environment: "test", status: "pending" }],
            ]
            const { feed, proof, inbound } = await build([testState, FED, AGENT])
            proof.proveCasso.mockResolvedValue(delivery({ error: 0, data: tx1 }))

            await feed.acceptCassoDelivery(cassoDelivery)

            expect(inbound.recordBankPayment).toHaveBeenCalledWith(expect.objectContaining({ origin: "simulated" }))
        })

        it("names the bank the credit came through when the connection row cannot be read", async () => {
            const { feed, proof, inbound } = await build([NO_STATE, FED, AGENT])
            proof.proveCasso.mockResolvedValue(delivery({ error: 0, data: tx1 }))

            await feed.acceptCassoDelivery(cassoDelivery)

            expect(inbound.recordBankPayment).toHaveBeenCalledWith(
                expect.objectContaining({ origin: "live", body: expect.stringContaining('"bank":"ACB"') }),
            )
        })

        it("enqueues no second job for a redelivered transaction", async () => {
            const { feed, outbox, proof, inbound } = await build([STATE, FED, AGENT])
            proof.proveCasso.mockResolvedValue(delivery({ error: 0, data: tx1 }))
            inbound.recordBankPayment.mockResolvedValue({ duplicate: true, inboundEventId: "event-7" })

            await feed.acceptCassoDelivery(cassoDelivery)

            expect(outbox.jobs).toEqual([])
        })

        it("rolls back and fails when a credit cannot be booked, so Casso retries", async () => {
            const { feed, tx, proof, inbound } = await build([STATE, FED, AGENT])
            proof.proveCasso.mockResolvedValue(delivery({ error: 0, data: tx1 }))
            const failure = new BillingError({ code: BillingErrorCode.WebhookInvalid })
            inbound.recordBankPayment.mockRejectedValue(failure)

            await expect(feed.acceptCassoDelivery(cassoDelivery)).rejects.toBe(failure)

            expect(tx.rollbacks).toBe(1)
        })
    })

    describe("acceptPayosDelivery", () => {
        const data = { orderCode: 99, amount: 50000, description: "NIVO8F3K2", reference: "REF1" }
        const payosDelivery = { connectionId: "conn-1", rawBody: raw({}) }
        const proven = (body: ProvenDelivery["body"]): PayosProof => ({ kind: "proven", connection: CONNECTION, body })

        it("books a paid order as a credit keyed by its reference", async () => {
            const { feed, proof, inbound } = await build([STATE, FED, AGENT])
            proof.provePayos.mockResolvedValue(proven({ code: "00", success: true, data }))

            await feed.acceptPayosDelivery(payosDelivery)

            expect(proof.provePayos).toHaveBeenCalledWith(payosDelivery)
            expect(inbound.recordBankPayment).toHaveBeenCalledWith(
                expect.objectContaining({ amountVnd: 50000, providerRef: "payos:REF1", externalRef: "NIVO8F3K2" }),
            )
        })

        it("names payOS when the connection row cannot be read", async () => {
            const { feed, proof, inbound } = await build([NO_STATE, FED, AGENT])
            proof.provePayos.mockResolvedValue(proven({ code: "00", data }))

            await feed.acceptPayosDelivery(payosDelivery)

            expect(inbound.recordBankPayment).toHaveBeenCalledWith(
                expect.objectContaining({ body: expect.stringContaining('"bank":"payOS"') }),
            )
        })

        it("books nothing for the confirmation ping, an unpaid delivery and a refused proof", async () => {
            const { feed, tx, proof, inbound } = await build([])
            proof.provePayos.mockResolvedValueOnce({ kind: "sample" })
            proof.provePayos.mockResolvedValueOnce(proven({ code: "01", data }))
            proof.provePayos.mockRejectedValueOnce(refusal)

            await feed.acceptPayosDelivery(payosDelivery)
            await feed.acceptPayosDelivery(payosDelivery)
            await expect(feed.acceptPayosDelivery(payosDelivery)).rejects.toBe(refusal)

            expect(tx.outcomes).toEqual([])
            expect(inbound.recordBankPayment).not.toHaveBeenCalled()
        })
    })

    describe("acceptSepayFeedDelivery", () => {
        const feedDelivery = { connectionId: "conn-1", authorization: "Apikey k", rawBody: raw({}) }
        const incoming = {
            id: 321,
            transferType: "in",
            transferAmount: 99000,
            content: "NIVO8F3K2 thanh toan",
            gateway: "MBBank",
        }

        it("proves the delivery and books an incoming transfer keyed by the SePay transaction id", async () => {
            const { feed, proof, inbound } = await build([STATE, FED, AGENT])
            proof.proveSepayFeed.mockResolvedValue(delivery(incoming))

            await feed.acceptSepayFeedDelivery(feedDelivery)

            expect(proof.proveSepayFeed).toHaveBeenCalledWith(feedDelivery)
            expect(inbound.recordBankPayment).toHaveBeenCalledWith(
                expect.objectContaining({
                    amountVnd: 99000,
                    providerRef: "sepay:321",
                    externalRef: "NIVO8F3K2 thanh toan",
                }),
            )
        })

        it("falls back to the description, then the code, then nothing, and to SePay for the bank", async () => {
            const byDescription = await build([NO_STATE, FED, AGENT])
            byDescription.proof.proveSepayFeed.mockResolvedValue(
                delivery({ id: 5, transferType: "in", transferAmount: 10, description: " from description " }),
            )
            const byCode = await build([STATE, FED, AGENT])
            byCode.proof.proveSepayFeed.mockResolvedValue(
                delivery({ id: 6, transferType: "in", transferAmount: 10, code: "CODE1" }),
            )
            const bare = await build([STATE, FED, AGENT])
            bare.proof.proveSepayFeed.mockResolvedValue(delivery({ id: 7, transferType: "in", transferAmount: 10 }))

            await byDescription.feed.acceptSepayFeedDelivery(feedDelivery)
            await byCode.feed.acceptSepayFeedDelivery(feedDelivery)
            await bare.feed.acceptSepayFeedDelivery(feedDelivery)

            expect(byDescription.inbound.recordBankPayment).toHaveBeenCalledWith(
                expect.objectContaining({
                    externalRef: "from description",
                    body: expect.stringContaining('"bank":"SePay"'),
                }),
            )
            expect(byCode.inbound.recordBankPayment).toHaveBeenCalledWith(
                expect.objectContaining({ externalRef: "CODE1" }),
            )
            expect(bare.inbound.recordBankPayment).toHaveBeenCalledWith(expect.objectContaining({ externalRef: null }))
        })

        it("books nothing for outgoing transfers, transfers without a usable amount and a refused proof", async () => {
            const { feed, tx, proof, inbound } = await build([])
            proof.proveSepayFeed
                .mockResolvedValueOnce(delivery({ ...incoming, transferType: "out" }))
                .mockResolvedValueOnce(delivery({ ...incoming, transferAmount: 0 }))
                .mockResolvedValueOnce(delivery({ ...incoming, transferAmount: "lots" }))
                .mockRejectedValueOnce(refusal)

            await feed.acceptSepayFeedDelivery(feedDelivery)
            await feed.acceptSepayFeedDelivery(feedDelivery)
            await feed.acceptSepayFeedDelivery(feedDelivery)
            await expect(feed.acceptSepayFeedDelivery(feedDelivery)).rejects.toBe(refusal)

            expect(tx.outcomes).toEqual([])
            expect(inbound.recordBankPayment).not.toHaveBeenCalled()
        })
    })

    describe("holdForOwnerCheck", () => {
        it("holds the event of a bank-credit payload for the owner and ignores any other payload", async () => {
            const { feed, inbound } = await build([])

            await feed.holdForOwnerCheck({ workspaceId: "ws-1", inboundEventId: "event-1", amountVnd: 5 })
            await feed.holdForOwnerCheck({ orderId: "order-1" })

            expect(inbound.holdForOwnerCheck).toHaveBeenCalledTimes(1)
            expect(inbound.holdForOwnerCheck).toHaveBeenCalledWith("event-1")
        })
    })
})
