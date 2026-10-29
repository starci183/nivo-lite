import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { WebhookEventsService } from "@modules/domain/webhook-connections"
import { DealWonEvent, DecisionMadeEvent, LeadCapturedEvent } from "@modules/events/api"
import type { OrderConfirmedEvent, OrderShippedEvent, PaymentReconciledEvent } from "@modules/events/api"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type { BaseEvent, EventDelivery } from "@modules/platform/event-bus"
import { INBOX } from "@modules/platform/inbox"
import type { Inbox } from "@modules/platform/inbox"
import { AutomationEngineService } from "./automation-engine.service"
import { AutomationReactionsService } from "./automation-reactions.service"
import { AutomationsService } from "./automations.service"

const build = async (fresh = true) => {
    const transaction = fakeTransaction(mockEntityManager())
    const claim = jest.fn().mockResolvedValue(fresh)
    const engine = mock<AutomationEngineService>()
    engine.onBusinessEvent.mockResolvedValue(undefined)
    engine.startPaymentReceipt.mockResolvedValue(undefined)
    const automations = mock<AutomationsService>()
    automations.emit.mockResolvedValue(undefined)
    const webhooks = mock<WebhookEventsService>()
    webhooks.publish.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [
            AutomationReactionsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: transaction.em },
            { provide: INBOX, useValue: mock<Inbox>({ claim }) },
            { provide: AutomationEngineService, useValue: engine },
            { provide: AutomationsService, useValue: automations },
            { provide: WebhookEventsService, useValue: webhooks },
        ],
    }).compile()
    return { reactions: moduleRef.get(AutomationReactionsService), transaction, claim, engine, automations, webhooks }
}

const deliveryOf = <Event extends BaseEvent>(consumer: string, event: Event): EventDelivery<Event> => ({
    correlationId: "corr-1",
    eventId: event.eventId,
    consumer,
    dedupeKey: event.payload.dedupeKey,
    event,
    attempt: 1,
})

const lead = LeadCapturedEvent.create({
    workspaceId: "ws-1",
    leadId: "lead-1",
    contactName: "Lan",
    company: "Hue Tea",
    channel: "Zalo",
    need: "tea",
    phone: "84901234567",
})

const deal = DealWonEvent.create({
    workspaceId: "ws-1",
    leadId: "lead-1",
    name: "Lan",
    company: "Hue Tea",
    channel: "Zalo",
    need: "tea",
    orderNo: "SO-1",
    amountVnd: 500000,
})

const decision = DecisionMadeEvent.create({
    workspaceId: "ws-1",
    workItemId: "wi-1",
    action: "send_quote",
    department: "sales",
    outcome: "approved",
    decidedBy: "Lan",
    leadId: "lead-1",
    summary: "Sent",
})

const paymentOf = (): PaymentReconciledEvent =>
    ({
        eventId: "inv-1",
        eventName: "payment_reconciled",
        payload: {
            dedupeKey: "inv-1",
            workspaceId: "ws-1",
            invoiceId: "inv-1",
            invoiceNo: "HD1",
            amountVnd: 350000,
            paidAt: "2026-10-12T10:00:00.000Z",
            transactionId: "tx-1",
            workItemId: "wi-1",
            subjectType: "transaction",
            subjectId: "tx-1",
            orderId: "o-1",
            orderNo: "SO-1",
            leadId: "lead-1",
            customer: "Lan",
            channel: "Zalo",
        },
    }) as PaymentReconciledEvent

const orderOf = (): OrderConfirmedEvent =>
    ({
        eventId: "o-1",
        eventName: "order_confirmed",
        payload: {
            dedupeKey: "o-1",
            workspaceId: "ws-1",
            orderId: "o-1",
            orderNo: "SO-1",
            leadId: "lead-1",
            customer: "Lan",
            items: "tea",
            amountVnd: 500000,
            channel: "Zalo",
            confirmedBy: "Mai",
        },
    }) as OrderConfirmedEvent

const shipmentOf = (): OrderShippedEvent =>
    ({
        eventId: "o-1",
        eventName: "order_shipped",
        payload: {
            dedupeKey: "o-1",
            workspaceId: "ws-1",
            userId: "user-1",
            orderId: "o-1",
            orderNo: "SO-1",
            leadId: "lead-1",
            carrier: "GHN",
            trackingCode: "GHN123",
            shippedAt: "2026-10-12T10:00:00.000Z",
        },
    }) as OrderShippedEvent

describe("AutomationReactionsService", () => {
    it("claims (consumer, dedupeKey) in the transaction of the effect, and a repeat starts nothing", async () => {
        const { reactions, claim, engine, webhooks } = await build(false)

        await reactions.onDealWon(deliveryOf("deal_won__automations", deal))

        expect(claim).toHaveBeenCalledWith("deal_won__automations", "deal.won:lead-1", expect.anything())
        expect(engine.onBusinessEvent).not.toHaveBeenCalled()
        expect(webhooks.publish).not.toHaveBeenCalled()
    })

    it("starts the lead.created pipelines from a captured lead, keyed as before", async () => {
        const { reactions, engine, webhooks } = await build()

        await reactions.onLeadCaptured(deliveryOf("lead_captured__automations", lead))

        expect(engine.onBusinessEvent).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            event: "lead.created",
            dedupe: "lead.created:lead-1",
            data: {
                lead_id: "lead-1",
                name: "Lan",
                company: "Hue Tea",
                channel: "Zalo",
                need: "tea",
                phone: "84901234567",
                email: null,
            },
        })
        expect(webhooks.publish).not.toHaveBeenCalled()
    })

    it("publishes deal.won to the pipelines and the webhooks, passing on only the facts the door knew", async () => {
        const { reactions, engine, webhooks } = await build()
        const data = {
            lead_id: "lead-1",
            name: "Lan",
            company: "Hue Tea",
            channel: "Zalo",
            need: "tea",
            order_no: "SO-1",
            amount_vnd: 500000,
        }

        await reactions.onDealWon(deliveryOf("deal_won__automations", deal))

        expect(engine.onBusinessEvent).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            event: "deal.won",
            dedupe: "deal.won:lead-1",
            data,
        })
        expect(webhooks.publish).toHaveBeenCalledWith(
            { workspaceId: "ws-1", event: "deal.won", data, dedupe: "deal.won:lead-1" },
            expect.anything(),
        )
    })

    it("publishes deal.won without the facts the door did not know", async () => {
        const { reactions, engine } = await build()
        const bare = DealWonEvent.create({
            workspaceId: "ws-1",
            leadId: "lead-2",
            name: "Binh",
            company: "Tea Co",
            channel: "Zalo",
            need: "tea",
        })

        await reactions.onDealWon(deliveryOf("deal_won__automations", bare))

        expect(engine.onBusinessEvent).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            event: "deal.won",
            dedupe: "deal.won:lead-2",
            data: { lead_id: "lead-2", name: "Binh", company: "Tea Co", channel: "Zalo", need: "tea" },
        })
    })

    it("passes on the source and the evidence of a deal when the door knew them", async () => {
        const { reactions, engine } = await build()
        const sourced = DealWonEvent.create({
            workspaceId: "ws-1",
            leadId: "lead-3",
            name: "Cuong",
            company: "Tea Co",
            channel: "Zalo",
            need: "tea",
            source: "payment",
            evidence: "Paid in full",
        })

        await reactions.onDealWon(deliveryOf("deal_won__automations", sourced))

        expect(engine.onBusinessEvent).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            event: "deal.won",
            dedupe: "deal.won:lead-3",
            data: {
                lead_id: "lead-3",
                name: "Cuong",
                company: "Tea Co",
                channel: "Zalo",
                need: "tea",
                source: "payment",
                evidence: "Paid in full",
            },
        })
    })

    it("publishes decision.made with the decision as the web app's emit carried it", async () => {
        const { reactions, engine, webhooks } = await build()
        const data = {
            work_item_id: "wi-1",
            action: "send_quote",
            department: "sales",
            outcome: "approved",
            decided_by: "Lan",
            lead_id: "lead-1",
            summary: "Sent",
        }

        await reactions.onDecisionMade(deliveryOf("decision_made__automations", decision))

        expect(engine.onBusinessEvent).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            event: "decision.made",
            dedupe: "decision.made:wi-1:approved",
            data,
        })
        expect(webhooks.publish).toHaveBeenCalledWith(
            expect.objectContaining({ event: "decision.made", data, dedupe: "decision.made:wi-1:approved" }),
            expect.anything(),
        )
    })

    it("publishes payment.received once per invoice", async () => {
        const { reactions, engine, webhooks } = await build()
        const data = {
            invoice_id: "inv-1",
            transaction_id: "tx-1",
            invoice_no: "HD1",
            order_id: "o-1",
            order_no: "SO-1",
            lead_id: "lead-1",
            customer: "Lan",
            amount_vnd: 350000,
            paid_at: "2026-10-12T10:00:00.000Z",
            channel: "Zalo",
        }

        await reactions.onPaymentReconciled(deliveryOf("payment_reconciled__automations", paymentOf()))

        expect(engine.onBusinessEvent).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            event: "payment.received",
            dedupe: "payment.received:inv-1",
            data,
        })
        expect(webhooks.publish).toHaveBeenCalledWith(
            expect.objectContaining({ event: "payment.received", dedupe: "payment.received:inv-1" }),
            expect.anything(),
        )
    })

    it("starts the receipt pipeline for the settled payment without the other pipelines", async () => {
        const { reactions, engine, webhooks, claim } = await build()

        await reactions.onPaymentReceipt(deliveryOf("payment_reconciled__payment_receipts", paymentOf()))

        expect(claim).toHaveBeenCalledWith("payment_reconciled__payment_receipts", "inv-1", expect.anything())
        expect(engine.startPaymentReceipt).toHaveBeenCalledWith("ws-1", "tx-1", "inv-1")
        expect(engine.onBusinessEvent).not.toHaveBeenCalled()
        expect(webhooks.publish).not.toHaveBeenCalled()
    })

    it("publishes order.confirmed to the pipelines and the webhooks", async () => {
        const { reactions, engine, webhooks } = await build()
        const data = {
            order_id: "o-1",
            order_no: "SO-1",
            lead_id: "lead-1",
            customer: "Lan",
            items: "tea",
            amount_vnd: 500000,
            channel: "Zalo",
            confirmed_by: "Mai",
            status: "confirmed",
        }

        await reactions.onOrderConfirmed(deliveryOf("order_confirmed__automations", orderOf()))

        expect(engine.onBusinessEvent).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            event: "order.confirmed",
            dedupe: "order.confirmed:o-1",
            data,
        })
        expect(webhooks.publish).toHaveBeenCalledWith(
            expect.objectContaining({ event: "order.confirmed", data }),
            expect.anything(),
        )
    })

    it("emits order.shipped as the member who recorded the shipment, deduplicated by order", async () => {
        const { reactions, automations, webhooks } = await build()

        await reactions.onOrderShipped(deliveryOf("order_shipped__automations", shipmentOf()))

        expect(automations.emit).toHaveBeenCalledWith("user-1", "ws-1", {
            event: "order.shipped",
            dedupe: "order.shipped:o-1",
            data: {
                order_id: "o-1",
                order_no: "SO-1",
                lead_id: "lead-1",
                carrier: "GHN",
                tracking_code: "GHN123",
                shipped_at: "2026-10-12T10:00:00.000Z",
            },
        })
        expect(webhooks.publish).not.toHaveBeenCalled()
    })

    it("reads a fact the door did not know as null in the event data", async () => {
        const { reactions, engine } = await build()
        const bareLead = LeadCapturedEvent.create({
            workspaceId: "ws-1",
            leadId: "lead-3",
            contactName: "Cuc",
            company: "Tea Co",
            channel: "Zalo",
            need: "tea",
        })
        const bareDeal = DealWonEvent.create({ workspaceId: "ws-1", leadId: "lead-3", name: "Cuc" })
        const bareDecision = DecisionMadeEvent.create({
            workspaceId: "ws-1",
            workItemId: "wi-2",
            action: "send_quote",
            department: "sales",
            outcome: "approved",
            decidedBy: "Lan",
            summary: "Sent",
        })

        await reactions.onLeadCaptured(deliveryOf("lead_captured__automations", bareLead))
        await reactions.onDealWon(deliveryOf("deal_won__automations", bareDeal))
        await reactions.onDecisionMade(deliveryOf("decision_made__automations", bareDecision))

        const [captured, won, decided] = engine.onBusinessEvent.mock.calls.map(([call]) => call.data)
        expect(captured).toMatchObject({ phone: null, email: null })
        expect(won).toMatchObject({ company: null, channel: null, need: null })
        expect(decided).toMatchObject({ lead_id: null })
    })

    it("reads a payment fact the invoice did not carry as null, and starts no receipt without a transaction", async () => {
        const { reactions, engine } = await build()
        const { payload } = paymentOf()
        const bare: PaymentReconciledEvent = {
            ...paymentOf(),
            payload: {
                dedupeKey: payload.dedupeKey,
                workspaceId: payload.workspaceId,
                invoiceId: payload.invoiceId,
                invoiceNo: payload.invoiceNo,
                workItemId: payload.workItemId,
                customer: payload.customer,
            },
        }

        await reactions.onPaymentReconciled(deliveryOf("payment_reconciled__automations", bare))
        await reactions.onPaymentReceipt(deliveryOf("payment_reconciled__payment_receipts", bare))

        expect(engine.onBusinessEvent.mock.calls[0]?.[0].data).toMatchObject({
            transaction_id: null,
            order_id: null,
            order_no: null,
            lead_id: null,
            amount_vnd: null,
            paid_at: null,
            channel: null,
        })
        expect(engine.startPaymentReceipt).toHaveBeenCalledWith("ws-1", null, "inv-1")
    })
})
