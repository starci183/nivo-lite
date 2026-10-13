import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AgentConversationsService } from "@modules/domain/agent-conversations"
import type { CustomerTurn } from "@modules/domain/conversations"
import { WorkEngineService } from "@modules/domain/decisions"
import type { WorkContext } from "@modules/domain/decisions"
import { InboundEventsService } from "@modules/domain/inbound-events"
import type { InvoiceRow } from "@modules/domain/invoices"
import { OrdersService } from "@modules/domain/orders"
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
}
const invoice: InvoiceRow = {
    id: "inv-1",
    workspace_id: WS,
    order_id: "o1",
    lead_id: "l1",
    invoice_no: "HD-01",
    amount_vnd: 50_000,
    status: "issued",
    origin: "live",
    issued_by: null,
    paid_at: null,
}

const build = async (openOrders: ReadonlyArray<object> = [], created = true) => {
    const engine = mock<WorkEngineService>({
        startOrderWork: jest.fn().mockResolvedValue({ id: "w2", status: "done", lead_id: "l9" }),
    })
    const inbound = mock<InboundEventsService>({
        recordInput: jest.fn().mockResolvedValue({ duplicate: false, inboundEventId: "e1" }),
        mark: jest.fn().mockResolvedValue(undefined),
    })
    const claims = mock<PaymentClaimsService>({ start: jest.fn().mockResolvedValue({ created }) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            TurnPurchasesService,
            { provide: MESSAGE_CATALOG, useValue: mock<MessageCatalog>({ get: jest.fn((key: string) => key) }) },
            { provide: WorkEngineService, useValue: engine },
            { provide: InboundEventsService, useValue: inbound },
            {
                provide: OrdersService,
                useValue: mock<OrdersService>({ listForLead: jest.fn().mockResolvedValue(openOrders) }),
            },
            {
                provide: AgentConversationsService,
                useValue: mock<AgentConversationsService>({ attachLead: jest.fn() }),
            },
            { provide: PaymentClaimsService, useValue: claims },
        ],
    }).compile()
    return { purchases: moduleRef.get(TurnPurchasesService), engine, inbound }
}

describe("TurnPurchasesService", () => {
    it("runs a new order through Sales and ties the customer to the conversation", async () => {
        const { purchases } = await build()
        const settled = await purchases.recordOrder(ctx, turn, {
            reply,
            order: { items: "Tra sua", amountVnd: 50_000 },
            channel,
            leadId: null,
        })
        expect(settled).toEqual({ lines: ["customerTurns.orderRecorded"], changed: true, leadId: "l9" })
    })

    it("does not order the same item twice while its order is open", async () => {
        const { purchases } = await build([{ status: "confirmed", amount_vnd: 50_000, items: "tra  SUA" }])
        const settled = await purchases.recordOrder(ctx, turn, {
            reply,
            order: { items: "Tra sua", amountVnd: 50_000 },
            channel,
            leadId: "l1",
        })
        expect(settled).toEqual({ lines: [], changed: false, leadId: "l1" })
    })

    it("joins a check already open for a repeated payment claim", async () => {
        const { purchases } = await build([], false)
        const settled = await purchases.recordClaim(ctx, turn, invoice, channel)
        expect(settled).toEqual({ lines: [], changed: false, leadId: null })
    })
})
