import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AgentConversationsService } from "@modules/domain/agent-conversations"
import type { CustomerTurn } from "@modules/domain/conversations"
import { WorkEngineService } from "@modules/domain/decisions"
import type { WorkContext } from "@modules/domain/decisions"
import { InboundEventsService } from "@modules/domain/inbound-events"
import type { InvoiceRow } from "@modules/domain/invoices"
import { OrderPaymentClaimsService, OrdersService } from "@modules/domain/orders"
import type { WorkItem } from "@modules/domain/work-items"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import type { CustomerReply } from "./customer-turns.contracts"
import { PaymentClaimsService } from "./payment-claims.service"
import { TurnPurchasesService } from "./turn-purchases.service"

const WS = "11111111-1111-4111-8111-111111111111"
const ctx: WorkContext = { workspaceId: WS, actor: "OpenClaw", locale: "vi" }
const channel = { key: "telegram" as const, label: "Telegram" }
const turn: CustomerTurn = {
    conversation: {
        id: "c1",
        workspaceId: WS,
        channel: "telegram",
        externalId: "42",
        connectionId: null,
        leadId: null,
        handledBy: null,
        visitorName: "Lan",
        installationId: null,
        agent: {
            id: "a1",
            name: "Bot",
            handle: "bot",
            role: "Chatbot",
            module: "chatbot",
            instructions: "",
            knowledge: "",
            approvalRule: "",
            greeting: "",
        },
        speaksAs: null,
    },
    messageId: "m1",
    body: "I want one milk tea",
    channelEventId: "tg:42:1",
    transcript: [],
}
const reply: CustomerReply = {
    reply: "Thanks!",
    needsHuman: false,
    reason: null,
    proposedAnswer: null,
    lead: null,
    order: null,
    paymentClaim: false,
    knowledgeGap: null,
    application: null,
    loyaltyRewardKey: null,
    bookingRequest: null,
}
const invoice: InvoiceRow = {
    id: "inv-1",
    workspace_id: WS,
    order_id: "o1",
    lead_id: "l1",
    invoice_no: "HD-01",
    amount_vnd: 50_000,
    status: "issued",
    issued_by: null,
    paid_at: null,
    contract_id: null,
    period_ends_on: null,
}

const ORDER_WORK = { id: "w2", status: "done", lead_id: "l9", subject_type: "order", subject_id: "o-9" }

const build = async (
    openOrders: ReadonlyArray<object> = [],
    created = true,
    work: object = ORDER_WORK,
    recorded: { amount_vnd: number | null } | null = { amount_vnd: 50_000 },
) => {
    const engine = mock<WorkEngineService>({ startOrderWork: jest.fn().mockResolvedValue(work) })
    const inbound = mock<InboundEventsService>({
        recordInput: jest.fn().mockResolvedValue({ duplicate: false, inboundEventId: "e1" }),
        mark: jest.fn().mockResolvedValue(undefined),
    })
    const claims = mock<PaymentClaimsService>({ start: jest.fn().mockResolvedValue({ created }) })
    const orders = mock<OrdersService>({
        listForLead: jest.fn().mockResolvedValue(openOrders),
        find: jest.fn().mockResolvedValue(recorded),
    })
    const orderClaims = mock<OrderPaymentClaimsService>({ record: jest.fn().mockResolvedValue(true) })
    const conversations = mock<AgentConversationsService>({ attachLead: jest.fn() })
    const catalog = mock<MessageCatalog>({ get: jest.fn((key: string) => key) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            TurnPurchasesService,
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: WorkEngineService, useValue: engine },
            { provide: InboundEventsService, useValue: inbound },
            { provide: OrdersService, useValue: orders },
            { provide: AgentConversationsService, useValue: conversations },
            { provide: PaymentClaimsService, useValue: claims },
            { provide: OrderPaymentClaimsService, useValue: orderClaims },
        ],
    }).compile()
    return { purchases: moduleRef.get(TurnPurchasesService), engine, inbound, orders, conversations, claims, orderClaims }
}

describe("TurnPurchasesService", () => {
    it("runs a new order through Sales and ties the customer to the conversation", async () => {
        const { purchases, orders } = await build()
        const settled = await purchases.recordOrder(ctx, turn, {
            reply,
            order: { items: "Tra sua", amountVnd: 50_000 },
            channel,
            leadId: null,
        })
        expect(settled).toEqual({
            lines: ["customerTurns.orderRecorded"],
            changed: true,
            leadId: "l9",
            orderAmountVnd: 50_000,
        })
        expect(orders.find).toHaveBeenCalledWith(WS, "o-9")
    })

    it("answers no order amount when the work drafted no order, the record is gone or it holds no amount", async () => {
        const input = { reply, order: { items: "Tra sua", amountVnd: 50_000 }, channel, leadId: null }
        const lead = await build([], true, { ...ORDER_WORK, subject_type: "lead" })
        const unnamed = await build([], true, { ...ORDER_WORK, subject_id: null })
        const gone = await build([], true, ORDER_WORK, null)
        const blank = await build([], true, ORDER_WORK, { amount_vnd: null })

        await expect(lead.purchases.recordOrder(ctx, turn, input)).resolves.toMatchObject({ orderAmountVnd: null })
        await expect(unnamed.purchases.recordOrder(ctx, turn, input)).resolves.toMatchObject({ orderAmountVnd: null })
        await expect(gone.purchases.recordOrder(ctx, turn, input)).resolves.toMatchObject({ orderAmountVnd: null })
        await expect(blank.purchases.recordOrder(ctx, turn, input)).resolves.toMatchObject({ orderAmountVnd: null })
        expect(lead.orders.find).not.toHaveBeenCalled()
        expect(unnamed.orders.find).not.toHaveBeenCalled()
    })

    it("does not order the same item twice while its order is open", async () => {
        const { purchases } = await build([{ status: "confirmed", amount_vnd: 50_000, items: "tra  SUA" }])
        const settled = await purchases.recordOrder(ctx, turn, {
            reply,
            order: { items: "Tra sua", amountVnd: 50_000 },
            channel,
            leadId: "l1",
        })
        expect(settled).toEqual({ lines: [], changed: false, leadId: "l1", orderAmountVnd: 50_000 })
    })

    it("joins a check already open for a repeated payment claim", async () => {
        const { purchases } = await build([], false)
        const settled = await purchases.recordClaim(ctx, turn, invoice, channel)
        expect(settled).toEqual({ lines: [], changed: false, leadId: null })
    })

    it("does nothing when the reply has no order", async () => {
        const { purchases, inbound } = await build()
        await expect(purchases.recordOrder(ctx, turn, { reply, order: null, channel, leadId: null })).resolves.toEqual({
            lines: [],
            changed: false,
            leadId: null,
        })
        expect(inbound.recordInput).not.toHaveBeenCalled()
    })

    it("ignores a repeated order input", async () => {
        const { purchases, inbound, engine } = await build()
        inbound.recordInput.mockResolvedValue({ duplicate: true, inboundEventId: "e1" })
        await expect(
            purchases.recordOrder(ctx, turn, {
                reply,
                order: { items: "Tra sua", amountVnd: 50_000 },
                channel,
                leadId: null,
            }),
        ).resolves.toEqual({ lines: [], changed: false, leadId: null })
        expect(engine.startOrderWork).not.toHaveBeenCalled()
    })
})

describe("TurnPurchasesService", () => {
    it("names the sender from the lead phone, then the email, and does not attach a lead the order already has", async () => {
        const phone = {
            ...reply,
            lead: { contactName: "Minh", company: "", need: "tea", phone: "0912", email: null },
        }
        const { purchases, inbound, conversations, engine } = await build()
        const item = mock<WorkItem>({ id: "w2", status: "done", lead_id: null })
        engine.startOrderWork.mockResolvedValue(item)
        await purchases.recordOrder(ctx, turn, {
            reply: phone,
            order: { items: "Tra sua", amountVnd: 50_000 },
            channel,
            leadId: "l1",
        })
        expect(inbound.recordInput).toHaveBeenCalledWith(
            expect.objectContaining({ senderName: "Minh", senderContact: "0912" }),
        )
        expect(conversations.attachLead).not.toHaveBeenCalled()

        const email = {
            ...reply,
            lead: { contactName: "Minh", company: "", need: "tea", phone: null, email: "m@e.com" },
        }
        await purchases.recordOrder(ctx, turn, {
            reply: email,
            order: { items: "Tra sua", amountVnd: 40_000 },
            channel,
            leadId: null,
        })
        expect(inbound.recordInput).toHaveBeenLastCalledWith(expect.objectContaining({ senderContact: "m@e.com" }))
    })

    it("orders again when the open order is paid, a different amount, or a different item", async () => {
        const { purchases, engine, inbound } = await build([
            { status: "paid", amount_vnd: 50_000, items: "Tra sua" },
            { status: "confirmed", amount_vnd: 10, items: "Tra sua" },
            { status: "draft", amount_vnd: 50_000, items: "Tra da" },
        ])
        const settled = await purchases.recordOrder(ctx, turn, {
            reply,
            order: { items: "Tra sua", amountVnd: 50_000 },
            channel,
            leadId: "l1",
        })
        expect(settled.changed).toBe(true)
        expect(engine.startOrderWork).toHaveBeenCalled()
        expect(inbound.mark).not.toHaveBeenCalled()
    })

    it("marks a repeated claim handled and records a new one", async () => {
        const { purchases, inbound } = await build()
        inbound.recordInput.mockResolvedValueOnce({ duplicate: true, inboundEventId: "e1" })
        await expect(purchases.recordClaim(ctx, turn, invoice, channel)).resolves.toEqual({
            lines: [],
            changed: false,
            leadId: null,
        })
        expect(inbound.mark).not.toHaveBeenCalled()

        inbound.recordInput.mockResolvedValueOnce({ duplicate: false, inboundEventId: "e2" })
        const created = await purchases.recordClaim(ctx, turn, invoice, channel)
        expect(created).toEqual({ lines: ["customerTurns.claimRecorded"], changed: true, leadId: null })
        expect(inbound.mark).not.toHaveBeenCalled()
    })
})

describe("TurnPurchasesService", () => {
    it("ignores a payment claim with no invoice", async () => {
        const { purchases, inbound } = await build()
        await expect(purchases.recordClaim(ctx, turn, null, channel)).resolves.toEqual({
            lines: [],
            changed: false,
            leadId: null,
        })
        expect(inbound.recordInput).not.toHaveBeenCalled()
    })

    it("marks the input processed when the open order is the same item", async () => {
        const { purchases, inbound } = await build([{ status: "invoiced", amount_vnd: 50_000, items: "Tra sua" }])
        await purchases.recordOrder(ctx, turn, {
            reply,
            order: { items: "Tra sua", amountVnd: 50_000 },
            channel,
            leadId: "l1",
        })
        expect(inbound.mark).toHaveBeenCalledWith(WS, "e1", "processed", "l1")
    })
})

describe("TurnPurchasesService order claims", () => {
    const claimTurn: CustomerTurn = {
        ...turn,
        body: "Tôi đã chuyển khoản 5k, tên BUI NGUYEN DINH",
        conversation: { ...turn.conversation, leadId: "l1" },
    }

    it("knows a customer with a confirmed or invoiced order awaits payment, and one with only a paid order does not", async () => {
        const waiting = await build([{ status: "confirmed", amount_vnd: 5000, items: "Chau hoa" }])
        await expect(waiting.purchases.awaitsPayment(WS, "l1")).resolves.toBe(true)
        const paid = await build([{ status: "paid", amount_vnd: 5000, items: "Chau hoa" }])
        await expect(paid.purchases.awaitsPayment(WS, "l1")).resolves.toBe(false)
    })

    it("writes the claim with the amount and the account holder read from the words, once per message", async () => {
        const { purchases, orderClaims } = await build()
        const settled = await purchases.recordOrderClaim(ctx, claimTurn, true)
        expect(settled).toEqual({ lines: ["customerTurns.orderClaimRecorded"], changed: true, leadId: "l1" })
        expect(orderClaims.record).toHaveBeenCalledWith({
            workspaceId: WS,
            leadId: "l1",
            conversationId: "c1",
            amountVnd: 5000,
            names: ["BUI NGUYEN DINH"],
            body: claimTurn.body,
            dedupeKey: `${claimTurn.channelEventId}:order-claim`,
        })
        orderClaims.record.mockResolvedValueOnce(false)
        await expect(purchases.recordOrderClaim(ctx, claimTurn, true)).resolves.toEqual({
            lines: [],
            changed: false,
            leadId: "l1",
        })
    })

    it("writes nothing when the words are no claim or the customer is unknown", async () => {
        const { purchases, orderClaims } = await build()
        await purchases.recordOrderClaim(ctx, claimTurn, false)
        await purchases.recordOrderClaim(ctx, turn, true)
        expect(orderClaims.record).not.toHaveBeenCalled()
    })
})
