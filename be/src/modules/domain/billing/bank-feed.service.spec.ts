import {
    NOW,
    receipt,
    providers,
    receiptCasesOf,
    tx1,
    incoming,
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
import { FakeClock, fakeTransaction, mock, mockEntityManager, recordingEventBus } from "@starci/jest-preset"
import { isTransactionManager } from "@starci/jest-preset/entity-manager"
import { AgentBindingsService } from "@modules/domain/agent-connections"
import { ConnectionBindingsReadService } from "@modules/domain/connections"
import { EventsService } from "@modules/domain/events"
import { InboundEventsService } from "@modules/domain/inbound-events"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { BankFeedReceiptService } from "@modules/domain/bank-feed-inbox"
import { BankCreditBookedEvent } from "@modules/events/api"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { EVENT_BUS } from "@modules/platform/event-bus"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { BankFeedFlowService } from "./bank-feed-flow.service"
import { BankFeedService } from "./bank-feed.service"
import type { IncomingCredit } from "@modules/domain/bank-feed-inbox"
import type { BankFeedProvider } from "./billing.contracts"
import { BillingError, BillingErrorCode } from "./errors/billing.error"

const MARK_CONNECTION_FED = 'SELECT * FROM "public"."connection_mark_fed"($1, $2, $3)'

const textLike = (text: string): unknown => expect.stringContaining(text)
const objectLike = (shape: Record<string, unknown>): unknown => expect.objectContaining(shape)
const refusal = new BillingError({ code: BillingErrorCode.WebhookInvalid })
const cases = receiptCasesOf(tx1, incoming)
const build = async (world: Partial<FeedWorld> = {}) => {
    const tx = fakeTransaction(mockEntityManager({ query: [MARK_CONNECTION_FED, []] }))
    const connections = mock<ConnectionBindingsReadService>()
    const bindings = mock<AgentBindingsService>()
    arrangeFeedOwners({ ...FEED_WORLD, ...world }, connections, bindings)
    const catalog = mock<MessageCatalog>()
    catalog.get.mockImplementation((key, params, locale) => `${locale}:${key}:${JSON.stringify(params)}`)
    const inbound = mock<InboundEventsService>()
    inbound.recordBankPayment.mockResolvedValue({ duplicate: false, inboundEventId: "event-1" })
    const bus = recordingEventBus<BankCreditBookedEvent>()
    const publish = jest.spyOn(bus, "publish")
    const members = mock<WorkspaceMembersService>()
    arrangeOwningMember(members)
    const events = mock<EventsService>()
    const flows = mock<BankFeedFlowService>()
    flows.owns.mockResolvedValue(false)
    flows.debit.mockResolvedValue({ status: "debited" })
    const feedInbox = mock<BankFeedReceiptService>()
    feedInbox.claim.mockResolvedValue(true)
    feedInbox.lock.mockResolvedValue(receipt)
    const moduleRef = await Test.createTestingModule({
        providers: [
            BankFeedService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: InboundEventsService, useValue: inbound },
            { provide: EVENT_BUS, useValue: bus },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: EventsService, useValue: events },
            { provide: BankFeedFlowService, useValue: flows },
            { provide: BankFeedReceiptService, useValue: feedInbox },
            { provide: AgentBindingsService, useValue: bindings },
            { provide: ConnectionBindingsReadService, useValue: connections },
        ],
    }).compile()
    return {
        feed: moduleRef.get(BankFeedService),
        tx,
        inbound,
        bus,
        publish,
        members,
        events,
        flows,
        feedInbox,
        bindings,
        connections,
    }
}
// Each intake and consumption uses its own transaction; the stored payload crosses that boundary.
const consumeCredits = async (
    harness: Awaited<ReturnType<typeof build>>,
    provider: BankFeedProvider,
    credits: ReadonlyArray<IncomingCredit>,
) => {
    harness.feedInbox.lock.mockResolvedValue({ id: "receipt-1", payload: { connection: "conn-1", credits } })
    await harness.feed.processRecordedFeedDelivery({ provider, deliveryId: "id" })
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
        await consumeCredits(harness, "casso", [
            { amount: 150000, content: "NIVO8F3K2", eventId: "casso:7", fallbackBankName: "ACB" },
            { amount: 5000, content: "NIVO8F3K2", eventId: "casso:8", fallbackBankName: "ACB" },
        ])
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
    it.each(cases)("uses the $provider bank fallback and original event identity", async ({ provider, credits }) => {
        const harness = await build(NO_STATE)
        await consumeCredits(harness, provider, credits)
        expect(harness.inbound.recordBankPayment).toHaveBeenCalledWith(
            expect.objectContaining({
                providerRef: credits[0]?.eventId,
                body: textLike(`"bank":"${credits[0]?.fallbackBankName}"`),
            }),
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
    const outgoing = {
        amount: 45000.4,
        content: "Pay supplier",
        eventId: "sepay:654",
        fallbackBankName: "MBBank",
        direction: "debit" as const,
    }
    const debitPayload = (eventId: string) => ({
        connection: "c-1",
        credits: [{ amount: 10, content: "x", eventId, fallbackBankName: "SePay", direction: "debit" as const }],
    })
    it("hands a debit to the flow in the receipt transaction, with no payment event and no reconcile job", async () => {
        const harness = await build()
        await consumeCredits(harness, "sepay-feed", [outgoing])
        const manager = harness.feedInbox.lock.mock.calls[0]?.[0]
        expect(harness.flows.debit).toHaveBeenCalledWith(
            manager,
            { connectionId: "conn-1", workspaceId: "ws-1" },
            objectLike({ amount: 45000.4, content: "Pay supplier", eventId: "sepay:654", direction: "debit" }),
        )
        expect(harness.inbound.recordBankPayment).not.toHaveBeenCalled()
        expect(harness.bus.writes).toEqual([])
        expect(harness.feedInbox.complete).toHaveBeenCalledWith(manager, "receipt-1")
    })
    it("answers what the flow answered for a debit", async () => {
        const { feed, feedInbox, flows } = await build()
        feedInbox.lock.mockResolvedValue({ ...receipt, payload: debitPayload("sepay:1") })
        await expect(
            feed.processRecordedFeedDelivery({ provider: "sepay-feed", deliveryId: "c-1:1" }),
        ).resolves.toEqual([{ status: "debited" }])
        expect(flows.debit).toHaveBeenCalledTimes(1)
    })
    it.each([
        ["a test-environment", TEST_ENVIRONMENT, { status: "refused", code: "test_environment" }],
        ["an unbound", NO_AGENT, { status: "unbound" }],
    ])("books no debit of %s connection", async (_name, world, answer) => {
        const { feed, feedInbox, flows, tx } = await build(world)
        feedInbox.lock.mockResolvedValue({ ...receipt, payload: debitPayload("sepay:2") })
        await expect(
            feed.processRecordedFeedDelivery({ provider: "sepay-feed", deliveryId: "c-1:2" }),
        ).resolves.toEqual([answer])
        expect(flows.debit).not.toHaveBeenCalled()
        expect(tx.em.query).toHaveBeenCalledWith(MARK_CONNECTION_FED, expect.anything())
    })
})
describe("BankFeedService hands a new credit to the flow of the bound agent", () => {
    const credit = { amount: 5000, content: "BUI NGUYEN DINH", eventId: "sepay:95958515", fallbackBankName: "MBBank" }
    const arrange = async (world: Partial<FeedWorld> = {}, owns = true) => {
        const harness = await build(world)
        harness.flows.owns.mockResolvedValue(owns)
        harness.feedInbox.lock.mockResolvedValue({ ...receipt, payload: { connection: "c-1", credits: [credit] } })
        return harness
    }
    const consume = (harness: Awaited<ReturnType<typeof build>>) =>
        harness.feed.processRecordedFeedDelivery({ provider: "sepay-feed", deliveryId: "c-1:sepay:95958515" })

    it("records the inbound event without announcing it and tags the agent once, when its live version has a flow", async () => {
        const harness = await arrange()

        await expect(consume(harness)).resolves.toEqual([{ status: "booked" }])

        const manager = harness.feedInbox.lock.mock.calls[0]?.[0]
        expect(harness.flows.owns).toHaveBeenCalledWith("ws-1", "agent-1")
        expect(harness.flows.tag).toHaveBeenCalledWith(
            manager,
            { connectionId: "c-1", workspaceId: "ws-1" },
            "agent-1",
            credit,
            "event-1",
        )
        expect(harness.publish).not.toHaveBeenCalled()
    })

    it("keeps the booking path for an agent with no flow: booked and announced, nothing tagged", async () => {
        const harness = await arrange({}, false)

        await expect(consume(harness)).resolves.toEqual([{ status: "booked" }])

        expect(harness.flows.tag).not.toHaveBeenCalled()
        expect(harness.publish).toHaveBeenCalledTimes(1)
    })

    it.each([
        ["a credit already booked", {}, true],
        ["a connection with no agent bound", NO_AGENT, false],
    ])("tags nobody for %s", async (_name, world, duplicate) => {
        const harness = await arrange(world)
        harness.inbound.recordBankPayment.mockResolvedValue({ duplicate, inboundEventId: "event-1" })

        await consume(harness)

        expect(harness.flows.tag).not.toHaveBeenCalled()
    })
})
