import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AgentBindingsService } from "@modules/domain/agent-connections"
import type { BoundAgent } from "@modules/domain/agent-connections"
import type { TurnConversation } from "@modules/domain/agent-conversations"
import type { CustomerTurn } from "@modules/domain/conversations"
import { EvidenceService } from "@modules/domain/decisions"
import type { WorkContext } from "@modules/domain/decisions"
import { BookingChatService } from "@modules/domain/work-performers"
import type { ChatBookingRequest } from "@modules/domain/work-performers"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import type { CustomerReply } from "./customer-turns.contracts"
import { GatewayContextService } from "./gateway-context.service"
import { TurnModulesService } from "./turn-modules.service"

const WS = "11111111-1111-4111-8111-111111111111"
const ctx: WorkContext = { workspaceId: WS, actor: "OpenClaw", locale: "vi" }
const conversationOf = (module = "chatbot", visitorName: string | null = "Lan"): TurnConversation => ({
    id: "c1",
    workspaceId: WS,
    channel: "telegram",
    externalId: "42",
    connectionId: "conn1",
    leadId: "lead1",
    handledBy: null,
    visitorName,
    installationId: null,
    agent: {
        id: "a1",
        name: "Bot",
        handle: "bot",
        role: "Chatbot",
        module,
        instructions: "",
        knowledge: "",
        approvalRule: "",
        greeting: "",
    },
    speaksAs: null,
})
const turnOf = (conversation: TurnConversation = conversationOf()): CustomerTurn => ({
    conversation,
    messageId: "m1",
    body: "Book a haircut",
    channelEventId: "tg:42:1",
    transcript: [],
})
const request: ChatBookingRequest = {
    intent: "book",
    service: "Haircut",
    date: "2026-10-15",
    time: "09:00",
    from: null,
    to: null,
    partySize: 1,
    name: "Lan",
    phone: "0900",
    email: null,
    note: null,
}
const replyOf = (changes: Partial<CustomerReply> = {}): CustomerReply => ({
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
    ...changes,
})
const bookingAgent: BoundAgent = {
    id: "booking1",
    module: "booking",
    name: "Appointments",
    access: "auto",
    purpose: "inbound_chat",
}
const otherAgent: BoundAgent = { ...bookingAgent, id: "other1", module: "chatbot", name: "Other" }
const build = async () => {
    const catalog = { get: jest.fn((key: string) => key) }
    const bindings = { handoversOf: jest.fn().mockResolvedValue([]) }
    const evidence = { log: jest.fn().mockResolvedValue(undefined) }
    const booking = {
        brief: jest.fn().mockResolvedValue("BOOKING RULES"),
        apply: jest.fn().mockResolvedValue({ reply: "Your appointment is requested", state: "requested" }),
    }
    const connectors = {
        servesConnectors: jest.fn().mockResolvedValue(false),
        partyOf: jest.fn().mockResolvedValue(null),
        briefOf: jest.fn().mockReturnValue(["CONNECTOR CLAUSE"]),
        remember: jest.fn().mockResolvedValue(undefined),
    }
    const moduleRef = await Test.createTestingModule({
        providers: [
            TurnModulesService,
            { provide: MESSAGE_CATALOG, useValue: mock<MessageCatalog>(catalog) },
            { provide: AgentBindingsService, useValue: mock<AgentBindingsService>(bindings) },
            { provide: EvidenceService, useValue: mock<EvidenceService>(evidence) },
            { provide: BookingChatService, useValue: mock<BookingChatService>(booking) },
            { provide: GatewayContextService, useValue: mock<GatewayContextService>(connectors) },
        ],
    }).compile()
    return {
        modules: moduleRef.get(TurnModulesService),
        catalog,
        bindings,
        evidence,
        booking,
        connectors,
    }
}

describe("TurnModulesService", () => {
    it("adds booking facts and the addendum when a front door can hand over to booking", async () => {
        const { modules, bindings, booking, catalog } = await build()
        bindings.handoversOf.mockResolvedValueOnce([otherAgent, bookingAgent])
        await expect(modules.briefs(conversationOf())).resolves.toEqual(["BOOKING RULES", "bundle.bookingAddendum"])
        expect(bindings.handoversOf).toHaveBeenCalledWith("conn1", { module: "chatbot" })
        expect(booking.brief).toHaveBeenCalledWith(WS)
        expect(catalog.get).toHaveBeenCalledWith("bundle.bookingAddendum", {}, "vi")
    })

    it("uses the booking module's own contract", async () => {
        const { modules, bindings, booking, catalog } = await build()
        await expect(modules.briefs(conversationOf("booking"))).resolves.toEqual(["BOOKING RULES"])
        expect(bindings.handoversOf).not.toHaveBeenCalled()
        expect(booking.brief).toHaveBeenCalledWith(WS)
        expect(catalog.get).not.toHaveBeenCalledWith("bundle.bookingAddendum", {}, "vi")
    })

    it("leaves out empty booking facts while preserving the booking addendum", async () => {
        const { modules, bindings, booking } = await build()
        booking.brief.mockResolvedValueOnce("")
        bindings.handoversOf.mockResolvedValueOnce([bookingAgent])
        await expect(modules.briefs(conversationOf())).resolves.toEqual(["bundle.bookingAddendum"])
        expect(booking.brief).toHaveBeenCalledWith(WS)
    })

    it("returns no blocks when the agent has no booking access", async () => {
        const { modules, booking, catalog } = await build()
        await expect(modules.briefs(conversationOf())).resolves.toEqual([])
        expect(booking.brief).not.toHaveBeenCalled()
        expect(catalog.get).not.toHaveBeenCalled()
    })
})

describe("TurnModulesService", () => {
    it("leaves a reply without module requests alone", async () => {
        const { modules, booking, bindings, evidence } = await build()
        await expect(modules.settle(ctx, turnOf(), replyOf())).resolves.toEqual({ reply: null, lines: [] })
        expect(booking.apply).not.toHaveBeenCalled()
        expect(bindings.handoversOf).not.toHaveBeenCalled()
        expect(evidence.log).not.toHaveBeenCalled()
    })

    it("ignores a booking request when the agent cannot book or hand over to booking", async () => {
        const { modules, booking, bindings, evidence } = await build()
        bindings.handoversOf.mockResolvedValueOnce([otherAgent])
        await expect(modules.settle(ctx, turnOf(), replyOf({ bookingRequest: request }))).resolves.toEqual({
            reply: null,
            lines: [],
        })
        expect(bindings.handoversOf).toHaveBeenCalledWith("conn1", { module: "chatbot" })
        expect(booking.apply).not.toHaveBeenCalled()
        expect(evidence.log).not.toHaveBeenCalled()
    })

    it("applies a booking through a handover and logs its state against the customer message", async () => {
        const { modules, booking, bindings, evidence, catalog } = await build()
        bindings.handoversOf.mockResolvedValueOnce([bookingAgent])
        await expect(modules.settle(ctx, turnOf(), replyOf({ bookingRequest: request }))).resolves.toEqual({
            reply: "Your appointment is requested",
            lines: [],
        })
        expect(booking.apply).toHaveBeenCalledWith({
            workspaceId: WS,
            conversationId: "c1",
            leadId: "lead1",
            messageId: "m1",
            visitorName: "Lan",
            request,
        })
        expect(catalog.get).toHaveBeenCalledWith(
            "customerTurns.bookingEvidence",
            { intent: "book", state: "requested" },
            "vi",
        )
        expect(evidence.log).toHaveBeenCalledWith(ctx, {
            lead_id: "lead1",
            kind: "booking.chat_request",
            actor: "OpenClaw",
            summary: "customerTurns.bookingEvidence",
            evidence: "m1",
        })
    })

    it("keeps the reply when a booking module schedules its own notice and the visitor is unnamed", async () => {
        const { modules, booking, bindings, evidence } = await build()
        booking.apply.mockResolvedValueOnce({ reply: null, state: "notice_queued" })
        await expect(
            modules.settle(ctx, turnOf(conversationOf("booking", null)), replyOf({ bookingRequest: request })),
        ).resolves.toEqual({ reply: null, lines: [] })
        expect(booking.apply).toHaveBeenCalledWith({
            workspaceId: WS,
            conversationId: "c1",
            leadId: "lead1",
            messageId: "m1",
            visitorName: "",
            request,
        })
        expect(bindings.handoversOf).not.toHaveBeenCalled()
        expect(evidence.log).toHaveBeenCalledTimes(1)
    })
})

describe("TurnModulesService connectors", () => {
    const party = { found: true, partyId: "p1", name: "Lan" }
    const lead = { contactName: "Lan", company: "", need: "two nights", phone: "0900", email: null }

    it("adds the connector clause and the party for an agent holding connector grants", async () => {
        const { modules, connectors } = await build()
        connectors.servesConnectors.mockResolvedValue(true)
        connectors.partyOf.mockResolvedValue(party)
        await expect(modules.briefs(conversationOf())).resolves.toEqual(["CONNECTOR CLAUSE"])
        expect(connectors.partyOf).toHaveBeenCalledWith(conversationOf())
        expect(connectors.briefOf).toHaveBeenCalledWith(party)
    })

    it("adds no connector block for an agent without connector grants", async () => {
        const { modules, connectors } = await build()
        await expect(modules.briefs(conversationOf())).resolves.toEqual([])
        expect(connectors.partyOf).not.toHaveBeenCalled()
    })

    it("makes the customer who gave their name a party of the connectors, keyed by the message", async () => {
        const { modules, connectors } = await build()
        connectors.servesConnectors.mockResolvedValue(true)
        await expect(modules.settle(ctx, turnOf(), replyOf({ lead }))).resolves.toEqual({ reply: null, lines: [] })
        expect(connectors.remember).toHaveBeenCalledWith(turnOf().conversation, lead, turnOf().messageId)
    })

    it("remembers nobody without a captured lead or without connector grants", async () => {
        const { modules, connectors } = await build()
        await modules.settle(ctx, turnOf(), replyOf({ lead }))
        connectors.servesConnectors.mockResolvedValue(true)
        await modules.settle(ctx, turnOf(), replyOf())
        expect(connectors.remember).not.toHaveBeenCalled()
    })
})
