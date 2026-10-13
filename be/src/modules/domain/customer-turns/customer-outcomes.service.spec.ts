import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import type { Logger } from "@modules/platform/logging"
import { AgentBindingsService } from "@modules/domain/agent-connections"
import { AgentConversationsService } from "@modules/domain/agent-conversations"
import { KnowledgeGapNotesService } from "@modules/domain/agent-knowledge"
import type { CustomerTurn, ChatTurnProposal } from "@modules/domain/conversations"
import { CommandBusService, EvidenceService, WorkEngineService } from "@modules/domain/decisions"
import { HiringPublicService } from "@modules/domain/hiring"
import { InboundEventsService } from "@modules/domain/inbound-events"
import { InvoicesService } from "@modules/domain/invoices"
import { WorkItemsService } from "@modules/domain/work-items"
import { CLOCK } from "@modules/platform/clock"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { LOGGER } from "@modules/platform/logging"
import { CustomerOutcomesService } from "./customer-outcomes.service"
import { StaffEscalationService } from "./staff-escalation.service"
import { TurnPurchasesService } from "./turn-purchases.service"

const WS = "11111111-1111-4111-8111-111111111111"
const catalog: MessageCatalog = { get: (key: string) => key }

const turnOf = (leadId: string | null = null, knowledge = "Tra sua: 50.000d"): CustomerTurn => ({
    conversation: {
        id: "c1",
        workspaceId: WS,
        channel: "telegram",
        externalId: "42",
        connectionId: null,
        leadId,
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
            knowledge,
            approvalRule: "",
            greeting: "",
        },
    },
    messageId: "m1",
    body: "I want one milk tea",
    channelEventId: "tg:42:1",
    transcript: [{ role: "user", body: "I want one milk tea" }],
})

const proposalOf = (
    detail: Readonly<Record<string, unknown>>,
    changes: Partial<ChatTurnProposal> = {},
): ChatTurnProposal => ({
    reply: "Thanks!",
    needsHuman: false,
    reason: "",
    proposedAnswer: "",
    detail,
    ...changes,
})

const build = async () => {
    const engine = {
        runWork: jest.fn().mockResolvedValue({ id: "w1", status: "waiting_decision", lead_id: null }),
        startOrderWork: jest.fn().mockResolvedValue({ id: "w2", status: "done", lead_id: "l9" }),
        runQueued: jest.fn().mockResolvedValue(0),
    }
    const bus = {
        sendCommandItem: jest.fn().mockResolvedValue({ id: "w3", status: "done", lead_id: "l9", reason: null }),
    }
    const inbound = {
        recordInput: jest.fn().mockResolvedValue({ duplicate: false, inboundEventId: "e1" }),
        mark: jest.fn().mockResolvedValue(undefined),
    }
    const invoices = { latestOfLead: jest.fn().mockResolvedValue(null) }
    const settled = { lines: [], changed: false, leadId: null }
    const purchases = {
        recordOrder: jest.fn().mockResolvedValue(settled),
        recordClaim: jest
            .fn()
            .mockResolvedValue({ lines: ["customerTurns.claimRecorded"], changed: true, leadId: null }),
    }
    const conversations = { rename: jest.fn(), attachLead: jest.fn() }
    const gaps = { note: jest.fn().mockResolvedValue(undefined) }
    const moduleRef = await Test.createTestingModule({
        providers: [
            CustomerOutcomesService,
            { provide: MESSAGE_CATALOG, useValue: mock<MessageCatalog>(catalog) },
            { provide: CLOCK, useValue: new FakeClock("2026-10-13T10:00:00.000Z") },
            { provide: LOGGER, useValue: mock<Logger>({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }) },
            { provide: WorkEngineService, useValue: mock<WorkEngineService>(engine) },
            { provide: CommandBusService, useValue: mock<CommandBusService>(bus) },
            { provide: EvidenceService, useValue: mock<EvidenceService>({ log: jest.fn() }) },
            {
                provide: WorkItemsService,
                useValue: mock<WorkItemsService>({ findByDedupe: jest.fn().mockResolvedValue(null) }),
            },
            { provide: InboundEventsService, useValue: mock<InboundEventsService>(inbound) },
            { provide: InvoicesService, useValue: mock<InvoicesService>(invoices) },
            { provide: AgentConversationsService, useValue: mock<AgentConversationsService>(conversations) },
            {
                provide: AgentBindingsService,
                useValue: mock<AgentBindingsService>({ agentsFor: jest.fn().mockResolvedValue([]) }),
            },
            {
                provide: HiringPublicService,
                useValue: mock<HiringPublicService>({ registerChatApplication: jest.fn() }),
            },
            { provide: TurnPurchasesService, useValue: mock<TurnPurchasesService>(purchases) },
            {
                provide: StaffEscalationService,
                useValue: mock<StaffEscalationService>({ escalate: jest.fn().mockResolvedValue(true) }),
            },
            { provide: KnowledgeGapNotesService, useValue: mock<KnowledgeGapNotesService>(gaps) },
        ],
    }).compile()
    return { outcomes: moduleRef.get(CustomerOutcomesService), engine, bus, inbound, invoices, purchases, gaps }
}

describe("CustomerOutcomesService", () => {
    it("hands a captured lead to Sales through the gate, once per channel message", async () => {
        const { outcomes, bus, inbound } = await build()
        const verdict = await outcomes.settle(
            turnOf(),
            proposalOf({ lead: { contact_name: "Lan", need: "milk tea for 20 people", phone: "0900" } }),
        )
        expect(inbound.recordInput).toHaveBeenCalledWith(expect.objectContaining({ kind: "lead", eventId: "tg:42:1" }))
        expect(bus.sendCommandItem).toHaveBeenCalledWith(
            expect.any(Object),
            expect.objectContaining({ command: "handoff_lead", dedupeKey: "handoff_lead:conversation:c1" }),
        )
        expect(verdict).toMatchObject({ reply: "Thanks!", send: true, lines: ["customerTurns.chatHandoff"] })
    })

    it("takes an order only at a price written in the knowledge", async () => {
        const known = await build()
        await known.outcomes.settle(turnOf(), proposalOf({ order: { items: "Tra sua", amount_vnd: 50_000 } }))
        expect(known.purchases.recordOrder).toHaveBeenCalledWith(
            expect.any(Object),
            expect.any(Object),
            expect.objectContaining({ order: { items: "Tra sua", amountVnd: 50_000 } }),
        )
        const unknown = await build()
        const verdict = await unknown.outcomes.settle(
            turnOf(),
            proposalOf({ order: { items: "Tra sua", amount_vnd: 99_000 } }),
        )
        expect(unknown.purchases.recordOrder).toHaveBeenCalledWith(
            expect.any(Object),
            expect.any(Object),
            expect.objectContaining({ order: null }),
        )
        expect(verdict.reply).toBe("customerTurns.orderPriceUnknownReply")
        expect(unknown.engine.runWork).toHaveBeenCalledWith(
            expect.any(Object),
            expect.objectContaining({ forceAsk: "over_authority" }),
        )
    })

    it("answers a payment claim with fixed text and opens one check for the open invoice", async () => {
        const { outcomes, invoices, purchases } = await build()
        invoices.latestOfLead.mockResolvedValueOnce({
            id: "inv-1",
            invoice_no: "HD-01",
            lead_id: "l1",
            amount_vnd: 50_000,
        })
        const verdict = await outcomes.settle(
            turnOf("l1"),
            proposalOf({ payment_claim: true }, { reply: "Paid, thanks!" }),
        )
        expect(verdict.reply).toBe("customerTurns.paymentClaimReply")
        expect(purchases.recordClaim).toHaveBeenCalledWith(
            expect.any(Object),
            expect.any(Object),
            expect.objectContaining({ invoice_no: "HD-01" }),
            expect.objectContaining({ key: "telegram" }),
        )
        expect(verdict.lines).toContain("customerTurns.claimRecorded")
    })

    it("hands the question to a person when the AI could not answer", async () => {
        const { outcomes, engine } = await build()
        await outcomes.holdOver(turnOf(), "openclaw_unavailable")
        expect(engine.runWork).toHaveBeenCalledWith(
            expect.any(Object),
            expect.objectContaining({
                action: "reply_customer",
                dedupeKey: "reply_customer:message:m1",
                forceAsk: "unclear_outcome",
            }),
        )
    })

    it("notes the knowledge gap the reply named", async () => {
        const { outcomes, gaps } = await build()
        await outcomes.settle(
            turnOf(),
            proposalOf({ knowledge_gap: { question: "Open Sunday?", topic: "Hours | Sunday" } }),
        )
        expect(gaps.note).toHaveBeenCalledWith(
            expect.objectContaining({
                signals: expect.objectContaining({
                    knowledgeGap: { question: "Open Sunday?", topic: "Hours | Sunday" },
                }),
            }),
        )
    })
})
