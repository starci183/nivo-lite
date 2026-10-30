import {
    NOW,
    receipt,
    providers,
    receiptCasesOf,
    tx1,
    incoming,
    feedDelivery,
} from "@tests/fixtures/builders/bank-feed-receipts.builder"
import {
    FEED_WORLD,
    NO_AGENT,
    NO_OWNER,
    NO_STATE,
    TEST_ENVIRONMENT,
    arrangeFeedOwners,
    arrangeOwningMember,
} from "@tests/fixtures/builders/bank-feed-world.builder"
import type { FeedWorld } from "@tests/fixtures/builders/bank-feed-world.builder"
import { Test } from "@nestjs/testing"
import {
    FakeClock,
    fakeTransaction,
    mock,
    mockEntityManager,
    recordingEventBus,
    recordingQueueOutbox,
} from "@starci/jest-preset"
import { isTransactionManager } from "@starci/jest-preset/entity-manager"
import { AgentBindingsService } from "@modules/domain/agent-connections"
import { ConnectionBindingsReadService } from "@modules/domain/connections"
import { EventsService } from "@modules/domain/events"
import { TransactionsService } from "@modules/domain/transactions"
import { InboundEventsService } from "@modules/domain/inbound-events"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { BankFeedReceiptService } from "@modules/domain/bank-feed-inbox"
import { SepayConnectionService } from "@modules/domain/channel-connections"
import { BankCreditBookedEvent } from "@modules/events/api"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { EVENT_BUS } from "@modules/platform/event-bus"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { QUEUE_OUTBOX } from "@modules/platform/queue"
import { BANK_FEED_DELIVERY_QUEUE } from "@modules/queues/bank-feed-delivery"
import { BankFeedService } from "./bank-feed.service"
import type { BankFeedProvider } from "./billing.contracts"
import { BillingError, BillingErrorCode } from "./errors/billing.error"
import { PaymentProofService } from "./payment-proof.service"

const MARK_CONNECTION_FED = 'SELECT * FROM "public"."connection_mark_fed"($1, $2, $3)'

/** What `run` throws, read as `unknown`; the matcher then judges its fields. */
const thrownBy = (run: () => unknown): unknown => {
    try {
        run()
    } catch (error) {
        return error
    }
    return undefined
}

const textLike = (text: string): unknown => expect.stringContaining(text)
const objectLike = (shape: Record<string, unknown>): unknown => expect.objectContaining(shape)
const raw = (body: object): Buffer => Buffer.from(JSON.stringify(body))
const refusal = new BillingError({ code: BillingErrorCode.WebhookInvalid })
const cases = receiptCasesOf(tx1, incoming)
const build = async (world: Partial<FeedWorld> = {}) => {
    const tx = fakeTransaction(mockEntityManager({ query: [MARK_CONNECTION_FED, []] }))
    const connections = mock<ConnectionBindingsReadService>()
    const bindings = mock<AgentBindingsService>()
    arrangeFeedOwners({ ...FEED_WORLD, ...world }, connections, bindings)
    const outbox = recordingQueueOutbox()
    const write = jest.spyOn(outbox, "write")
    const catalog = mock<MessageCatalog>()
    catalog.get.mockImplementation((key, params, locale) => `${locale}:${key}:${JSON.stringify(params)}`)
    const proof = mock<PaymentProofService>()
    const inbound = mock<InboundEventsService>()
    inbound.recordBankPayment.mockResolvedValue({ duplicate: false, inboundEventId: "event-1" })
    const bus = recordingEventBus<BankCreditBookedEvent>()
    const publish = jest.spyOn(bus, "publish")
    const members = mock<WorkspaceMembersService>()
    arrangeOwningMember(members)
    const events = mock<EventsService>()
    const transactions = mock<TransactionsService>()
    const feedInbox = mock<BankFeedReceiptService>()
    feedInbox.claim.mockResolvedValue(true)
    feedInbox.lock.mockResolvedValue(receipt)
    const sepayPage = mock<SepayConnectionService>()
    sepayPage.traceIntake.mockImplementation((_feed, _raw, intake) => intake())
    sepayPage.traceRefusal.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [
            BankFeedService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: PaymentProofService, useValue: proof },
            { provide: InboundEventsService, useValue: inbound },
            { provide: EVENT_BUS, useValue: bus },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: EventsService, useValue: events },
            { provide: TransactionsService, useValue: transactions },
            { provide: BankFeedReceiptService, useValue: feedInbox },
            { provide: SepayConnectionService, useValue: sepayPage },
            { provide: QUEUE_OUTBOX, useValue: outbox },
            { provide: AgentBindingsService, useValue: bindings },
            { provide: ConnectionBindingsReadService, useValue: connections },
        ],
    }).compile()
    return {
        feed: moduleRef.get(BankFeedService),
        tx,
        outbox,
        write,
        proof,
        inbound,
        bus,
        publish,
        members,
        events,
        transactions,
        feedInbox,
        sepayPage,
        bindings,
        connections,
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
    it("books manual money as live with the member as actor of its evidence, in the same transaction", async () => {
        const { feed, inbound, bus, members, events } = await build()
        await expect(feed.acceptManualCredit("user-1", "ws-1", manual)).resolves.toBe(false)
        const manager = inbound.recordBankPayment.mock.calls[0]?.[0].manager
        expect(isTransactionManager(manager)).toBe(true)
        expect(members.require).toHaveBeenCalledWith("user-1", "ws-1", ["owner", "manager"])
        expect(inbound.recordBankPayment).toHaveBeenCalledWith(
            expect.objectContaining({
                manager,
                workspaceId: "ws-1",
                sender: null,
                amountVnd: 150000,
                providerRef: "manual:2026-10-12:150000:NIVO8F3K2",
                externalRef: "NIVO8F3K2",
                body: 'vi:billing.bankEventBody:{"bank":"vi:billing.manualBank:{}","content":"NIVO8F3K2 - cash"}',
            }),
        )
        expect(bus.writes.map((event) => event.payload)).toEqual([
            { dedupeKey: "event-1", workspaceId: "ws-1", inboundEventId: "event-1", amountVnd: 150000 },
        ])
        expect(bus.entries[0]?.tx).toBe(manager)
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
        const { feed, inbound, bus, events } = await build()
        inbound.recordBankPayment.mockResolvedValue({ duplicate: true, inboundEventId: "event-1" })
        await expect(feed.acceptManualCredit("u", "ws-1", manual)).resolves.toBe(true)
        expect(bus.writes).toEqual([])
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
        expect(tx.em.createQueryBuilder).not.toHaveBeenCalled()
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
    it("ignores Casso errors, payOS pings/unpaid deliveries and unknown or unusable SePay transfers", async () => {
        const { feed, tx, feedInbox } = await build()
        await feed.acceptCassoDelivery(raw({ error: 3, data: tx1 }), "conn-1")
        await feed.acceptCassoDelivery(raw({ error: 0, data: [{ id: 9, amount: -1 }] }), "conn-1")
        await feed.acceptPayosDelivery(raw({ code: "00", data: { orderCode: 123, amount: 1 } }), "conn-1")
        await feed.acceptPayosDelivery(raw({ code: "01", data: {} }), "conn-1")
        await feed.acceptSepayFeedDelivery(raw({ ...incoming, transferType: "refund" }), "conn-1")
        await feed.acceptSepayFeedDelivery(raw({ ...incoming, transferType: "out", transferAmount: 0 }), "conn-1")
        await feed.acceptSepayFeedDelivery(raw({ ...incoming, transferAmount: 0 }), "conn-1")
        await feed.acceptSepayFeedDelivery(raw({ ...incoming, transferAmount: "lots" }), "conn-1")
        expect(feedInbox.claim).not.toHaveBeenCalled()
        expect(tx.outcomes).toEqual([])
    })
    it("acknowledges a SePay test ping without an id and settles nothing", async () => {
        const { feed, tx, feedInbox } = await build()
        await expect(feed.acceptSepayFeedDelivery(raw({}), "conn-1")).resolves.toBeUndefined()
        expect(feedInbox.claim).not.toHaveBeenCalled()
        expect(tx.outcomes).toEqual([])
    })
    it("rejects an absent Casso body before intake", async () => {
        const { feed, tx } = await build()
        expect(thrownBy(() => feed.acceptCassoDelivery(undefined, "conn-1"))).toEqual(
            objectLike({ code: BillingErrorCode.WebhookInvalid }),
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
describe("BankFeedService SePay connection page", () => {
    it.each([
        [new BillingError({ code: BillingErrorCode.WebhookUnauthorized }), 1],
        [refusal, 0],
    ])("remembers a refused key only, and rethrows %p", async (failure, traced) => {
        const { feed, proof, sepayPage } = await build()
        proof.proveSepayFeed.mockRejectedValue(failure)
        const result = feed.verifySepayFeedDelivery(feedDelivery.authorization, "conn-1", feedDelivery.rawBody)
        await expect(result).rejects.toBe(failure)
        expect(sepayPage.traceRefusal).toHaveBeenCalledTimes(traced)
    })
    it("hands the raw delivery to the page trace around the intake", async () => {
        const { feed, sepayPage } = await build()
        const body = raw({ ...incoming })
        await feed.acceptSepayFeedDelivery(body, "conn-1")
        expect(sepayPage.traceIntake).toHaveBeenCalledWith("conn-1", body, expect.any(Function))
    })
})
describe("BankFeedService deferred receipt effects", () => {
    it.each(providers)("locks, books and completes %s in the same transaction", async (provider) => {
        const { feed, feedInbox, inbound, bus, publish, tx } = await build()
        await expect(feed.processRecordedFeedDelivery({ provider, deliveryId: "c-1:7" })).resolves.toEqual([
            { status: "booked" },
        ])
        const manager = feedInbox.lock.mock.calls[0]?.[0]
        expect(isTransactionManager(manager)).toBe(true)
        expect(feedInbox.lock).toHaveBeenCalledWith(manager, provider, "c-1:7")
        expect(inbound.recordBankPayment).toHaveBeenCalledWith(
            expect.objectContaining({
                manager,
                workspaceId: "ws-1",
                providerRef: "bank:7",
                amountVnd: 125000,
                sender: null,
            }),
        )
        expect(bus.writes.map((event) => event.payload)).toEqual([
            { dedupeKey: "event-1", workspaceId: "ws-1", inboundEventId: "event-1", amountVnd: 125000 },
        ])
        expect(bus.entries[0]?.tx).toBe(manager)
        expect(bus.allInTransaction).toBe(true)
        expect(feedInbox.complete).toHaveBeenCalledWith(manager, "receipt-1")
        expect(feedInbox.complete.mock.invocationCallOrder[0]).toBeGreaterThan(publish.mock.invocationCallOrder[0] ?? 0)
        expect(tx.commits).toBe(1)
    })
    it("answers no credit for an absent or already completed receipt", async () => {
        const { feed, feedInbox, inbound } = await build()
        feedInbox.lock.mockResolvedValue(undefined)
        await expect(feed.processRecordedFeedDelivery({ provider: "payos", deliveryId: "absent" })).resolves.toEqual([])
        expect(inbound.recordBankPayment).not.toHaveBeenCalled()
        expect(feedInbox.complete).not.toHaveBeenCalled()
    })
    it.each(["missing connection", "empty credits"])("completes %s without booking", async (scenario) => {
        const { feed, feedInbox, inbound } = await build(scenario === "missing connection" ? NO_OWNER : {})
        if (scenario === "empty credits")
            feedInbox.lock.mockResolvedValue({ ...receipt, payload: { ...receipt.payload, credits: [] } })
        await expect(feed.processRecordedFeedDelivery({ provider: "casso", deliveryId: "c-1:7" })).resolves.toEqual([])
        expect(inbound.recordBankPayment).not.toHaveBeenCalled()
        expect(feedInbox.complete).toHaveBeenCalledWith(feedInbox.lock.mock.calls[0]?.[0], "receipt-1")
    })
    it("rolls back a failed booking without completing the receipt", async () => {
        const { feed, feedInbox, inbound, tx } = await build()
        inbound.recordBankPayment.mockRejectedValue(refusal)
        await expect(feed.processRecordedFeedDelivery({ provider: "casso", deliveryId: "c-1:7" })).rejects.toBe(refusal)
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
        const harness = await build(NO_AGENT)
        await expect(
            harness.feed.processRecordedFeedDelivery({ provider: "casso", deliveryId: "id" }),
        ).resolves.toEqual([{ status: "unbound" }])
        expect(harness.tx.em.query).toHaveBeenCalledWith(MARK_CONNECTION_FED, expect.anything())
        expect(harness.inbound.recordBankPayment).not.toHaveBeenCalled()
    })
    it.each(providers)(
        "refuses a %s credit of a test-environment connection before any business record",
        async (provider) => {
            const harness = await build(TEST_ENVIRONMENT)
            await expect(harness.feed.processRecordedFeedDelivery({ provider, deliveryId: "id" })).resolves.toEqual([
                { status: "refused", code: "test_environment" },
            ])
            expect(harness.tx.em.query).toHaveBeenCalledWith(MARK_CONNECTION_FED, expect.anything())
            expect(harness.bindings.agentsFor).not.toHaveBeenCalled()
            expect(harness.inbound.recordBankPayment).not.toHaveBeenCalled()
            expect(harness.bus.writes).toEqual([])
            expect(harness.feedInbox.complete).toHaveBeenCalledWith(expect.anything(), "receipt-1")
            expect(harness.tx.commits).toBe(1)
        },
    )
})
describe("BankFeedService booked credit details", () => {
    it.each(cases)(
        "uses the $provider bank fallback and original event identity",
        async ({ provider, body, credits }) => {
            const harness = await build(NO_STATE)
            await consumeFeed(harness, provider, body)
            expect(harness.inbound.recordBankPayment).toHaveBeenCalledWith(
                expect.objectContaining({
                    providerRef: credits[0]?.eventId,
                    body: textLike(`"bank":"${credits[0]?.fallbackBankName}"`),
                }),
            )
        },
    )
    it.each([
        { description: " from description ", expected: "from description" },
        { code: "CODE1", expected: "CODE1" },
        { expected: null },
    ])("uses SePay content fallback $expected", async ({ expected, ...fields }) => {
        const harness = await build(NO_STATE)
        await consumeFeed(harness, "sepay-feed", { id: 7, transferType: "in", transferAmount: 10, ...fields })
        expect(harness.inbound.recordBankPayment).toHaveBeenCalledWith(
            objectLike({ externalRef: expected, body: textLike('"bank":"SePay"') }),
        )
    })
    it("rounds and displays empty content, then completes duplicate credits without another job", async () => {
        const { feed, feedInbox, inbound, bus } = await build()
        feedInbox.lock.mockResolvedValue({
            ...receipt,
            payload: {
                connection: "c-1",
                credits: [{ amount: 1000.6, content: "", eventId: "bank:8", fallbackBankName: "Bank" }],
            },
        })
        inbound.recordBankPayment.mockResolvedValue({ duplicate: true, inboundEventId: "event-1" })
        await expect(feed.processRecordedFeedDelivery({ provider: "casso", deliveryId: "c-1:8" })).resolves.toEqual([
            { status: "duplicate" },
        ])
        expect(inbound.recordBankPayment).toHaveBeenCalledWith(
            expect.objectContaining({
                amountVnd: 1001,
                externalRef: null,
                sender: null,
                body: 'vi:billing.bankEventBody:{"bank":"Bank","content":"—"}',
            }),
        )
        expect(bus.writes).toEqual([])
        expect(feedInbox.complete).toHaveBeenCalled()
    })
    it("rolls back a failed bank_credit_booked publish before completing the receipt", async () => {
        const { feed, bus, feedInbox, tx } = await build()
        bus.failNext("publish", refusal)
        await expect(feed.processRecordedFeedDelivery({ provider: "payos", deliveryId: "c-1:7" })).rejects.toBe(refusal)
        expect(feedInbox.complete).not.toHaveBeenCalled()
        expect(tx.rollbacks).toBe(1)
    })
})
describe("BankFeedService debits", () => {
    const debitPayload = (amount: number, content: string, eventId: string) => ({
        connection: "c-1",
        credits: [{ amount, content, eventId, fallbackBankName: "SePay", direction: "debit" as const }],
    })
    const outgoing = { ...incoming, id: 654, transferType: "out", transferAmount: 45000.4, content: "Pay supplier" }
    it("claims a SePay transfer out as a debit receipt", async () => {
        const { feed, feedInbox } = await build()
        await feed.acceptSepayFeedDelivery(raw(outgoing), "conn-1")
        expect(feedInbox.claim).toHaveBeenCalledWith(expect.anything(), "sepay-feed", "conn-1:sepay:654", {
            connection: "conn-1",
            credits: [
                {
                    amount: 45000.4,
                    content: "Pay supplier",
                    eventId: "sepay:654",
                    fallbackBankName: "MBBank",
                    direction: "debit",
                },
            ],
        })
    })
    it("records a debit transaction in the receipt transaction, with no payment event and no reconcile job", async () => {
        const harness = await build()
        await consumeFeed(harness, "sepay-feed", outgoing)
        const manager = harness.feedInbox.lock.mock.calls[0]?.[0]
        expect(harness.transactions.open).toHaveBeenCalledWith(
            {
                workspaceId: "ws-1",
                inboundEventId: null,
                amountVnd: 45000,
                reference: "Pay supplier",
                payer: null,
                direction: "debit",
            },
            manager,
        )
        expect(harness.inbound.recordBankPayment).not.toHaveBeenCalled()
        expect(harness.bus.writes).toEqual([])
        expect(harness.feedInbox.complete).toHaveBeenCalledWith(manager, "receipt-1")
    })
    it("answers debited and stores no reference for an empty content", async () => {
        const { feed, feedInbox, transactions } = await build()
        feedInbox.lock.mockResolvedValue({
            ...receipt,
            payload: debitPayload(10, "", "sepay:1"),
        })
        await expect(
            feed.processRecordedFeedDelivery({ provider: "sepay-feed", deliveryId: "c-1:1" }),
        ).resolves.toEqual([{ status: "debited" }])
        expect(transactions.open).toHaveBeenCalledWith(expect.objectContaining({ reference: null }), expect.anything())
    })
    it.each([
        ["a test-environment", TEST_ENVIRONMENT, { status: "refused", code: "test_environment" }],
        ["an unbound", NO_AGENT, { status: "unbound" }],
    ])("books no debit of %s connection", async (_name, world, answer) => {
        const { feed, feedInbox, transactions, tx } = await build(world)
        feedInbox.lock.mockResolvedValue({
            ...receipt,
            payload: debitPayload(10, "x", "sepay:2"),
        })
        await expect(
            feed.processRecordedFeedDelivery({ provider: "sepay-feed", deliveryId: "c-1:2" }),
        ).resolves.toEqual([answer])
        expect(transactions.open).not.toHaveBeenCalled()
        expect(tx.em.query).toHaveBeenCalledWith(MARK_CONNECTION_FED, expect.anything())
    })
})
