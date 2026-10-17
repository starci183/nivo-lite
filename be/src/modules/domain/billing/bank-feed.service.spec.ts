import {
    NOW,
    receipt,
    simulated,
    providers,
    receiptCasesOf,
    tx1,
    incoming,
    feedDelivery,
} from "@tests/fixtures/builders/bank-feed-receipts.builder"
import { Test } from "@nestjs/testing"
import { FakeClock, builder, fakeTransaction, mock, mockEntityManager, recordingQueueOutbox } from "@starci/jest-preset"
import { isTransactionManager } from "@starci/jest-preset/entity-manager"
import type { ClaimedJob, JobClaims } from "@modules/platform/jobs"
import { EventsService } from "@modules/domain/events"
import { InboundEventsService } from "@modules/domain/inbound-events"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { VietcombankReceiptService } from "@modules/domain/vietcombank-inbox"
import { BankFeedReceiptService } from "@modules/domain/bank-feed-inbox"
import { CLOCK } from "@modules/platform/clock"
import { Secret } from "@modules/platform/config"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { QUEUE_OUTBOX } from "@modules/platform/queue"
import { BANK_CREDIT_QUEUE, BankCreditQueue } from "@modules/queues/bank-credit"
import { VIETCOMBANK_DELIVERY_QUEUE } from "@modules/queues/vietcombank-delivery"
import { BANK_FEED_DELIVERY_QUEUE } from "@modules/queues/bank-feed-delivery"
import { BankFeedService } from "./bank-feed.service"
import { BILLING_OPTIONS } from "./billing.decorators"
import type { BillingOptions } from "./billing.options"
import type { BankFeedProvider } from "./billing.contracts"
import { BillingError, BillingErrorCode } from "./errors/billing.error"
import { PaymentProofService } from "./payment-proof.service"
import {
    SELECT_FEED_CONNECTION,
    MARK_CONNECTION_FED,
    SELECT_BOUND_ACCOUNTING_AGENT,
    SELECT_CONNECTION_STATE,
} from "./persistence/bank-feed.sql"
const OPTIONS: BillingOptions = {
    sepayApiKey: undefined,
    bankAccount: { account: "", bank: "", holder: "" },
    simulatedBank: { secret: new Secret("s"), workspaceId: "ws-sim" },
    channelTokenKey: undefined,
}
type Stub = readonly [string, unknown]
const STATE: Stub = [SELECT_CONNECTION_STATE, [{ name: "Bank", environment: "live" }]]
const FED: Stub = [MARK_CONNECTION_FED, []]
const AGENT: Stub = [SELECT_BOUND_ACCOUNTING_AGENT, [{ id: "agent-1" }]]
const raw = (body: object): Buffer => Buffer.from(JSON.stringify(body))
const refusal = new BillingError({ code: BillingErrorCode.WebhookInvalid })
const credit = { amount_vnd: 1000.6, event_id: "tx-1" }
const cases = receiptCasesOf(tx1, incoming)
const build = async (stubs: ReadonlyArray<Stub> = [], options: Partial<BillingOptions> = {}) => {
    const tx = fakeTransaction(
        mockEntityManager({
            query: [...stubs, STATE, FED, AGENT, [SELECT_FEED_CONNECTION, [{ workspace_id: "ws-1" }]]],
        }),
    )
    const outbox = recordingQueueOutbox()
    const write = jest.spyOn(outbox, "write")
    const catalog = mock<MessageCatalog>()
    catalog.get.mockImplementation((key, params, locale) => `${locale}:${key}:${JSON.stringify(params)}`)
    const proof = mock<PaymentProofService>()
    const inbound = mock<InboundEventsService>()
    inbound.recordBankPayment.mockResolvedValue({ duplicate: false, inboundEventId: "event-1" })
    const credits = mock<BankCreditQueue>()
    credits.enqueueBankCredit.mockImplementation((payload, manager) =>
        outbox.write(manager, BANK_CREDIT_QUEUE, payload),
    )
    const members = mock<WorkspaceMembersService>()
    members.require.mockResolvedValue({
        userId: "user-1",
        workspaceId: "ws-1",
        role: "owner",
        staffId: null,
        displayName: "Lan",
        status: "active",
    })
    const events = mock<EventsService>()
    const bank = mock<VietcombankReceiptService>()
    bank.claim.mockResolvedValue(true)
    bank.lock.mockResolvedValue(simulated)
    const feedInbox = mock<BankFeedReceiptService>()
    feedInbox.claim.mockResolvedValue(true)
    feedInbox.lock.mockResolvedValue(receipt)
    const moduleRef = await Test.createTestingModule({
        providers: [
            BankFeedService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: BILLING_OPTIONS, useValue: builder<BillingOptions>(OPTIONS)(options) },
            { provide: PaymentProofService, useValue: proof },
            { provide: InboundEventsService, useValue: inbound },
            { provide: BankCreditQueue, useValue: credits },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: EventsService, useValue: events },
            { provide: VietcombankReceiptService, useValue: bank },
            { provide: BankFeedReceiptService, useValue: feedInbox },
            { provide: QUEUE_OUTBOX, useValue: outbox },
        ],
    }).compile()
    return {
        feed: moduleRef.get(BankFeedService),
        tx,
        outbox,
        write,
        proof,
        inbound,
        credits,
        members,
        events,
        bank,
        feedInbox,
    }
}
const acceptReceipt = (feed: BankFeedService, provider: BankFeedProvider, body: object) => {
    if (provider === "casso") return feed.acceptCassoDelivery(raw(body), "conn-1")
    if (provider === "payos") return feed.acceptPayosDelivery(raw(body), "conn-1")
    return feed.acceptSepayFeedDelivery(raw(body), "conn-1")
}
// Each intake and consumption uses its own transaction; the stored payload crosses that boundary.
const consumeFeed = async (harness: Awaited<ReturnType<typeof build>>, provider: BankFeedProvider, body: object) => {
    await acceptReceipt(harness.feed, provider, body)
    const call = harness.feedInbox.claim.mock.calls.at(-1)
    if (call === undefined) throw refusal
    harness.feedInbox.lock.mockResolvedValue({ id: "receipt-1", payload: call[3] })
    await harness.feed.processRecordedFeedDelivery({ provider, deliveryId: call[2] })
}
const manual = { amount: 150000.4, date: "2026-10-12", content: "NIVO8F3K2", note: "cash", payer: "" }
describe("BankFeedService manual credits", () => {
    it("books and reconciles simulated money and records member evidence in the same transaction", async () => {
        const { feed, inbound, credits, members, events } = await build()
        await expect(feed.acceptManualCredit("user-1", "ws-1", manual)).resolves.toBe(false)
        const manager = inbound.recordBankPayment.mock.calls[0]?.[0].manager
        expect(isTransactionManager(manager)).toBe(true)
        expect(members.require).toHaveBeenCalledWith("user-1", "ws-1", ["owner", "manager"])
        expect(inbound.recordBankPayment).toHaveBeenCalledWith(
            expect.objectContaining({
                manager,
                workspaceId: "ws-1",
                origin: "simulated",
                sender: null,
                amountVnd: 150000,
                providerRef: "manual:2026-10-12:150000:NIVO8F3K2",
                externalRef: "NIVO8F3K2",
                body: 'vi:billing.bankEventBody:{"bank":"vi:billing.manualBank:{}","content":"NIVO8F3K2 - cash"}',
            }),
        )
        expect(credits.enqueueBankCredit).toHaveBeenCalledWith(
            { workspaceId: "ws-1", inboundEventId: "event-1", amountVnd: 150000 },
            manager,
        )
        expect(events.record).toHaveBeenCalledWith(
            {
                workspaceId: "ws-1",
                kind: "accounting.manual_evidence",
                actor: "Lan",
                summary: 'vi:billing.manualEvidenceLog:{"amount":150000,"date":"2026-10-12"}',
                evidence: "NIVO8F3K2 - cash",
            },
            manager,
        )
    })
    it("does not reconcile or log duplicate evidence", async () => {
        const { feed, inbound, credits, events } = await build()
        inbound.recordBankPayment.mockResolvedValue({ duplicate: true, inboundEventId: "event-1" })
        await expect(feed.acceptManualCredit("u", "ws-1", manual)).resolves.toBe(true)
        expect(credits.enqueueBankCredit).not.toHaveBeenCalled()
        expect(events.record).not.toHaveBeenCalled()
    })
    it.each([undefined, "Lan"])("handles payer %p and absent notes", async (payer) => {
        const { feed, inbound, events } = await build()
        await feed.acceptManualCredit("u", "ws-1", { amount: 1, date: "2026-10-12", content: "", payer })
        expect(inbound.recordBankPayment).toHaveBeenCalledWith(
            expect.objectContaining({ sender: payer ?? null, externalRef: null }),
        )
        expect(events.record).toHaveBeenCalledWith(expect.objectContaining({ evidence: "" }), expect.anything())
    })
    it("rejects unauthorized members before opening a transaction", async () => {
        const { feed, members, tx } = await build()
        members.require.mockRejectedValue(refusal)
        await expect(feed.acceptManualCredit("u", "ws-1", manual)).rejects.toBe(refusal)
        expect(tx.outcomes).toEqual([])
    })
})
describe("BankFeedService provider receipt intake", () => {
    it.each(cases)("claims and queues $provider without booking", async ({ provider, body, deliveryId, credits }) => {
        const { feed, feedInbox, write, inbound, tx } = await build()
        await acceptReceipt(feed, provider, body)
        const manager = feedInbox.claim.mock.calls[0]?.[0]
        expect(isTransactionManager(manager)).toBe(true)
        expect(feedInbox.claim).toHaveBeenCalledWith(manager, provider, deliveryId, { connection: "conn-1", credits })
        expect(write).toHaveBeenCalledWith(
            manager,
            BANK_FEED_DELIVERY_QUEUE,
            { provider, deliveryId },
            { dedupeKey: `bank-feed-delivery:${provider}:${deliveryId}` },
        )
        expect(inbound.recordBankPayment).not.toHaveBeenCalled()
        expect(tx.em.query).not.toHaveBeenCalled()
    })
    it.each(cases)("acknowledges duplicate $provider receipts", async ({ provider, body }) => {
        const { feed, feedInbox, outbox, tx } = await build()
        feedInbox.claim.mockResolvedValue(false)
        await acceptReceipt(feed, provider, body)
        expect(outbox.jobs).toEqual([])
        expect(tx.commits).toBe(1)
    })
    it.each(cases)("rolls back failed $provider publication", async ({ provider, body }) => {
        const { feed, outbox, tx } = await build()
        outbox.failNext("write", refusal)
        await expect(acceptReceipt(feed, provider, body)).rejects.toBe(refusal)
        expect(tx.rollbacks).toBe(1)
    })
    it("ignores Casso errors, payOS pings/unpaid deliveries and outgoing or unusable SePay amounts", async () => {
        const { feed, tx, feedInbox } = await build()
        await feed.acceptCassoDelivery(raw({ error: 3, data: tx1 }), "conn-1")
        await feed.acceptCassoDelivery(raw({ error: 0, data: [{ id: 9, amount: -1 }] }), "conn-1")
        await feed.acceptPayosDelivery(raw({ code: "00", data: { orderCode: 123, amount: 1 } }), "conn-1")
        await feed.acceptPayosDelivery(raw({ code: "01", data: {} }), "conn-1")
        await feed.acceptSepayFeedDelivery(raw({ ...incoming, transferType: "out" }), "conn-1")
        await feed.acceptSepayFeedDelivery(raw({ ...incoming, transferAmount: 0 }), "conn-1")
        await feed.acceptSepayFeedDelivery(raw({ ...incoming, transferAmount: "lots" }), "conn-1")
        expect(feedInbox.claim).not.toHaveBeenCalled()
        expect(tx.outcomes).toEqual([])
    })
    it("rejects an absent Casso body before intake", async () => {
        const { feed, tx } = await build()
        expect(() => feed.acceptCassoDelivery(undefined, "conn-1")).toThrow(
            expect.objectContaining({ code: BillingErrorCode.WebhookInvalid }),
        )
        expect(tx.outcomes).toEqual([])
    })
    it.each([false, true])("propagates SePay proof failure %s before intake", async (fails) => {
        const { feed, proof, tx } = await build()
        if (fails) proof.proveSepayFeed.mockRejectedValue(refusal)
        const result = feed.verifySepayFeedDelivery(feedDelivery.authorization, "conn-1", feedDelivery.rawBody)
        if (fails) await expect(result).rejects.toBe(refusal)
        else await expect(result).resolves.toBeUndefined()
        expect(proof.proveSepayFeed).toHaveBeenCalledWith(feedDelivery)
        expect(tx.outcomes).toEqual([])
    })
})
describe("BankFeedService simulated receipt intake", () => {
    it("proves and claims the bank identity before queueing its receipt", async () => {
        const { feed, bank, proof, write, inbound, tx } = await build()
        await feed.acceptSimulatedCredit({ secret: "s", rawBody: raw(credit) })
        const manager = bank.claim.mock.calls[0]?.[0]
        expect(isTransactionManager(manager)).toBe(true)
        expect(proof.verifySimulatedBank).toHaveBeenCalledWith("s")
        expect(bank.claim).toHaveBeenCalledWith(manager, "vietcombank:tx-1", {
            workspaceId: "ws-sim",
            credit: { amount: 1000.6, content: "", sender: null, eventId: "tx-1" },
        })
        expect(write).toHaveBeenCalledWith(
            manager,
            VIETCOMBANK_DELIVERY_QUEUE,
            { deliveryId: "vietcombank:tx-1" },
            { dedupeKey: "vietcombank-delivery:vietcombank:tx-1" },
        )
        expect(inbound.recordBankPayment).not.toHaveBeenCalled()
        expect(tx.commits).toBe(1)
    })
    it("acknowledges duplicate bank receipts", async () => {
        const { feed, bank, outbox } = await build()
        bank.claim.mockResolvedValue(false)
        await feed.acceptSimulatedCredit({ secret: "s", rawBody: raw(credit) })
        expect(outbox.jobs).toEqual([])
    })
    it("rolls back failed bank receipt publication", async () => {
        const { feed, outbox, tx } = await build()
        outbox.failNext("write", refusal)
        await expect(feed.acceptSimulatedCredit({ secret: "s", rawBody: raw(credit) })).rejects.toBe(refusal)
        expect(tx.rollbacks).toBe(1)
    })
    it("rejects refused proof, invalid credit and missing configuration before intake", async () => {
        const refused = await build()
        refused.proof.verifySimulatedBank.mockImplementation(() => {
            throw refusal
        })
        const bad = await build()
        const off = await build([], { simulatedBank: { secret: undefined, workspaceId: undefined } })
        await expect(refused.feed.acceptSimulatedCredit({ secret: "x", rawBody: raw(credit) })).rejects.toBe(refusal)
        await expect(
            bad.feed.acceptSimulatedCredit({ secret: "s", rawBody: raw({ amount_vnd: 0 }) }),
        ).rejects.toMatchObject({ code: BillingErrorCode.WebhookInvalid })
        await expect(off.feed.acceptSimulatedCredit({ secret: "s", rawBody: raw(credit) })).rejects.toMatchObject({
            code: BillingErrorCode.FeedNotConfigured,
        })
        for (const harness of [refused, bad, off]) expect(harness.tx.outcomes).toEqual([])
    })
})
describe("BankFeedService deferred receipt effects", () => {
    it.each(providers)("locks, books and completes %s in the same transaction", async (provider) => {
        const { feed, feedInbox, inbound, credits, tx } = await build()
        await feed.processRecordedFeedDelivery({ provider, deliveryId: "c-1:7" })
        const manager = feedInbox.lock.mock.calls[0]?.[0]
        expect(isTransactionManager(manager)).toBe(true)
        expect(feedInbox.lock).toHaveBeenCalledWith(manager, provider, "c-1:7")
        expect(inbound.recordBankPayment).toHaveBeenCalledWith(
            expect.objectContaining({
                manager,
                workspaceId: "ws-1",
                providerRef: "bank:7",
                amountVnd: 125000,
                origin: "live",
            }),
        )
        expect(credits.enqueueBankCredit).toHaveBeenCalledWith(
            { workspaceId: "ws-1", inboundEventId: "event-1", amountVnd: 125000 },
            manager,
        )
        expect(feedInbox.complete).toHaveBeenCalledWith(manager, "receipt-1")
        expect(feedInbox.complete.mock.invocationCallOrder[0]).toBeGreaterThan(
            credits.enqueueBankCredit.mock.invocationCallOrder[0] ?? 0,
        )
        expect(tx.commits).toBe(1)
    })
    it("books simulated bank identity and payer before completion", async () => {
        const { feed, bank, inbound, credits } = await build()
        await feed.processRecordedDelivery({ deliveryId: "vietcombank:7" })
        const manager = bank.lock.mock.calls[0]?.[0]
        expect(isTransactionManager(manager)).toBe(true)
        expect(bank.lock).toHaveBeenCalledWith(manager, "vietcombank:7")
        expect(inbound.recordBankPayment).toHaveBeenCalledWith(
            expect.objectContaining({ manager, providerRef: "vietcombank:7", origin: "simulated", sender: "Lan" }),
        )
        expect(bank.complete).toHaveBeenCalledWith(manager, "receipt-2")
        expect(bank.complete.mock.invocationCallOrder[0]).toBeGreaterThan(
            credits.enqueueBankCredit.mock.invocationCallOrder[0] ?? 0,
        )
    })
    it("ignores absent or already completed receipts", async () => {
        const { feed, bank, feedInbox, inbound } = await build()
        bank.lock.mockResolvedValue(undefined)
        feedInbox.lock.mockResolvedValue(undefined)
        await feed.processRecordedDelivery({ deliveryId: "absent" })
        await feed.processRecordedFeedDelivery({ provider: "payos", deliveryId: "absent" })
        expect(inbound.recordBankPayment).not.toHaveBeenCalled()
        expect(bank.complete).not.toHaveBeenCalled()
        expect(feedInbox.complete).not.toHaveBeenCalled()
    })
    it.each(["missing connection", "empty credits"])("completes %s without booking", async (scenario) => {
        const { feed, feedInbox, inbound } = await build(
            scenario === "missing connection" ? [[SELECT_FEED_CONNECTION, []]] : [],
        )
        if (scenario === "empty credits")
            feedInbox.lock.mockResolvedValue({ ...receipt, payload: { ...receipt.payload, credits: [] } })
        await feed.processRecordedFeedDelivery({ provider: "casso", deliveryId: "c-1:7" })
        expect(inbound.recordBankPayment).not.toHaveBeenCalled()
        expect(feedInbox.complete).toHaveBeenCalledWith(feedInbox.lock.mock.calls[0]?.[0], "receipt-1")
    })
    it.each(["bank", "feed"])("rolls back failed %s booking without completion", async (kind) => {
        const { feed, bank, feedInbox, inbound, tx } = await build()
        inbound.recordBankPayment.mockRejectedValue(refusal)
        const result =
            kind === "bank"
                ? feed.processRecordedDelivery({ deliveryId: "bank:7" })
                : feed.processRecordedFeedDelivery({ provider: "casso", deliveryId: "c-1:7" })
        await expect(result).rejects.toBe(refusal)
        expect(bank.complete).not.toHaveBeenCalled()
        expect(feedInbox.complete).not.toHaveBeenCalled()
        expect(tx.rollbacks).toBe(1)
    })
})
describe("BankFeedService booking policies", () => {
    it("books every positive Casso credit and marks the connection fed", async () => {
        const harness = await build()
        await consumeFeed(harness, "casso", {
            error: 0,
            data: [tx1, { ...tx1, id: 8, amount: 5000 }, { id: 9, amount: -1 }],
        })
        expect(harness.inbound.recordBankPayment).toHaveBeenCalledTimes(2)
        expect(harness.inbound.recordBankPayment).toHaveBeenCalledWith(
            expect.objectContaining({ amountVnd: 150000, providerRef: "casso:7", externalRef: "NIVO8F3K2" }),
        )
        expect(harness.tx.em.query).toHaveBeenCalledWith(MARK_CONNECTION_FED, [
            "conn-1",
            new Date(NOW),
            JSON.stringify({ amount: 150000, content: "NIVO8F3K2", at: NOW }),
        ])
    })
    it("only marks a connection with no bound accounting agent", async () => {
        const harness = await build([[SELECT_BOUND_ACCOUNTING_AGENT, []]])
        await harness.feed.processRecordedFeedDelivery({ provider: "casso", deliveryId: "id" })
        expect(harness.tx.em.query).toHaveBeenCalledWith(MARK_CONNECTION_FED, expect.anything())
        expect(harness.inbound.recordBankPayment).not.toHaveBeenCalled()
    })
    it("labels test connections simulated", async () => {
        const harness = await build([[SELECT_CONNECTION_STATE, [{ name: "Test", environment: "test" }]]])
        await harness.feed.processRecordedFeedDelivery({ provider: "payos", deliveryId: "id" })
        expect(harness.inbound.recordBankPayment).toHaveBeenCalledWith(expect.objectContaining({ origin: "simulated" }))
    })
    it.each(cases)(
        "uses the $provider bank fallback and original event identity",
        async ({ provider, body, credits }) => {
            const harness = await build([[SELECT_CONNECTION_STATE, []]])
            await consumeFeed(harness, provider, body)
            expect(harness.inbound.recordBankPayment).toHaveBeenCalledWith(
                expect.objectContaining({
                    origin: "live",
                    providerRef: credits[0]?.eventId,
                    body: expect.stringContaining(`"bank":"${credits[0]?.fallbackBankName}"`),
                }),
            )
        },
    )
    it.each([
        { description: " from description ", expected: "from description" },
        { code: "CODE1", expected: "CODE1" },
        { expected: null },
    ])("uses SePay content fallback $expected", async ({ expected, ...fields }) => {
        const harness = await build([[SELECT_CONNECTION_STATE, []]])
        await consumeFeed(harness, "sepay-feed", { id: 7, transferType: "in", transferAmount: 10, ...fields })
        expect(harness.inbound.recordBankPayment).toHaveBeenCalledWith(
            expect.objectContaining({ externalRef: expected, body: expect.stringContaining('"bank":"SePay"') }),
        )
    })
    it("rounds and displays empty content, then completes duplicate credits without another job", async () => {
        const { feed, bank, inbound, credits } = await build()
        bank.lock.mockResolvedValue({
            ...simulated,
            payload: { workspaceId: "ws-1", credit: { amount: 1000.6, content: "", sender: null, eventId: "7" } },
        })
        inbound.recordBankPayment.mockResolvedValue({ duplicate: true, inboundEventId: "event-1" })
        await feed.processRecordedDelivery({ deliveryId: "vietcombank:7" })
        expect(inbound.recordBankPayment).toHaveBeenCalledWith(
            expect.objectContaining({
                amountVnd: 1001,
                externalRef: null,
                sender: null,
                body: 'vi:billing.bankEventBody:{"bank":"Vietcombank","content":"\u2014"}',
            }),
        )
        expect(credits.enqueueBankCredit).not.toHaveBeenCalled()
        expect(bank.complete).toHaveBeenCalled()
    })
    it("rolls back a reconcile queue failure before completing the receipt", async () => {
        const { feed, outbox, bank, tx } = await build()
        outbox.failNext("write", refusal)
        await expect(feed.processRecordedDelivery({ deliveryId: "bank:7" })).rejects.toBe(refusal)
        expect(bank.complete).not.toHaveBeenCalled()
        expect(tx.rollbacks).toBe(1)
    })
})
const jobOf = builder<ClaimedJob>({
    jobId: "job-1",
    kind: "vietcombank-delivery",
    fencingToken: 7,
    currentStep: null,
    payload: {},
})
describe("BankFeedService receipt job fencing", () => {
    it.each([{}, { deliveryId: null }, { deliveryId: 42 }, { deliveryId: "" }, { deliveryId: "   " }])(
        "ignores malformed references %p",
        async (payload) => {
            const { feed, bank, tx } = await build()
            const claims = mock<JobClaims>()
            await feed.processRecordedDeliveryJob(jobOf({ payload }), claims)
            expect(claims.advance).not.toHaveBeenCalled()
            expect(bank.lock).not.toHaveBeenCalled()
            expect(tx.outcomes).toEqual([])
        },
    )
    it("advances the fence before reading the receipt", async () => {
        const { feed, bank } = await build()
        const claims = mock<JobClaims>()
        claims.advance.mockImplementation(() => {
            expect(bank.lock).not.toHaveBeenCalled()
            return Promise.resolve()
        })
        await feed.processRecordedDeliveryJob(jobOf({ payload: { deliveryId: "delivery-1" } }), claims)
        expect(claims.advance).toHaveBeenCalledWith({
            jobId: "job-1",
            expectedFencingToken: 7,
            step: "vietcombank-delivery",
        })
        expect(bank.lock).toHaveBeenCalledWith(expect.anything(), "delivery-1")
    })
    it("stops a stale fence before receipt effects", async () => {
        const { feed, bank } = await build()
        const claims = mock<JobClaims>()
        claims.advance.mockRejectedValue(refusal)
        await expect(
            feed.processRecordedDeliveryJob(jobOf({ payload: { deliveryId: "delivery-1" } }), claims),
        ).rejects.toBe(refusal)
        expect(bank.lock).not.toHaveBeenCalled()
    })
    it("holds only valid bank credit payloads for owner review", async () => {
        const { feed, inbound } = await build()
        await feed.holdForOwnerCheck({ workspaceId: "ws-1", inboundEventId: "event-1", amountVnd: 5 })
        await feed.holdForOwnerCheck({ orderId: "order-1" })
        expect(inbound.holdForOwnerCheck).toHaveBeenCalledTimes(1)
        expect(inbound.holdForOwnerCheck).toHaveBeenCalledWith("event-1")
    })
})
