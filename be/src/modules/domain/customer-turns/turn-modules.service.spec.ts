import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AgentBindingsService } from "@modules/domain/agent-connections"
import type { BoundAgent } from "@modules/domain/agent-connections"
import type { TurnConversation } from "@modules/domain/agent-conversations"
import type { CustomerTurn } from "@modules/domain/conversations"
import { EvidenceService, WorkEngineService } from "@modules/domain/decisions"
import type { WorkContext } from "@modules/domain/decisions"
import { LoyaltyChatService } from "@modules/domain/loyalty"
import type { ChatCustomerRef } from "@modules/domain/loyalty-customer-links"
import type { LoyaltyReward } from "@modules/domain/loyalty-rewards"
import { BookingChatService } from "@modules/domain/work-performers"
import type { ChatBookingRequest } from "@modules/domain/work-performers"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import type { CustomerReply } from "./customer-turns.contracts"
import { GatewayContextService } from "./gateway-context.service"
import { TurnModulesService } from "./turn-modules.service"

type ChatRedeemIntent = Awaited<ReturnType<LoyaltyChatService["redeemIntent"]>>

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
    body: "Book a haircut and redeem my voucher",
    channelEventId: "tg:42:1",
    transcript: [],
})
const customerRef: ChatCustomerRef = {
    workspaceId: WS,
    conversationId: "c1",
    leadId: "lead1",
    channel: "telegram",
    externalId: "42",
}
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
const loyaltyAgent: BoundAgent = { ...bookingAgent, id: "loyalty1", module: "loyalty", name: "Rewards" }
const reward: LoyaltyReward = {
    id: "reward1",
    key: "tea-voucher",
    name: "Tea voucher",
    kind: "voucher",
    valueVnd: 50_000,
    percent: null,
    pointsCost: 100,
    stock: null,
    perCustomerLimit: null,
    minTierKey: null,
    note: "",
    active: true,
}
const openIntent: ChatRedeemIntent = { kind: "open", customerId: "customer1", customerName: "Lan", reward }

const build = async () => {
    const catalog = { get: jest.fn((key: string) => key) }
    const bindings = { handoversOf: jest.fn().mockResolvedValue([]) }
    const engine = { runWork: jest.fn().mockResolvedValue(undefined) }
    const evidence = { log: jest.fn().mockResolvedValue(undefined) }
    const booking = {
        brief: jest.fn().mockResolvedValue("BOOKING RULES"),
        apply: jest.fn().mockResolvedValue({ reply: "Your appointment is requested", state: "requested" }),
    }
    const loyalty = {
        brief: jest.fn().mockResolvedValue("LOYALTY FACTS"),
        redeemIntent: jest.fn().mockResolvedValue({ kind: "none" }),
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
            { provide: WorkEngineService, useValue: mock<WorkEngineService>(engine) },
            { provide: EvidenceService, useValue: mock<EvidenceService>(evidence) },
            { provide: BookingChatService, useValue: mock<BookingChatService>(booking) },
            { provide: LoyaltyChatService, useValue: mock<LoyaltyChatService>(loyalty) },
            { provide: GatewayContextService, useValue: mock<GatewayContextService>(connectors) },
        ],
    }).compile()
    return {
        modules: moduleRef.get(TurnModulesService),
        catalog,
        bindings,
        engine,
        evidence,
        booking,
        loyalty,
        connectors,
    }
}

describe("TurnModulesService", () => {
    it("adds loyalty facts and its contract to a front door without a booking handover", async () => {
        const { modules, loyalty, bindings, booking, catalog } = await build()
        const conversation = conversationOf()
        await expect(modules.briefs(conversation)).resolves.toEqual(["LOYALTY FACTS", "bundle.loyaltyContract"])
        expect(loyalty.brief).toHaveBeenCalledWith(customerRef)
        expect(bindings.handoversOf).toHaveBeenCalledWith("conn1", { module: "chatbot" })
        expect(booking.brief).not.toHaveBeenCalled()
        expect(catalog.get).toHaveBeenCalledWith("bundle.loyaltyContract", {}, "vi")
    })

    it("adds booking facts and the addendum when a front door can hand over to booking", async () => {
        const { modules, bindings, booking, catalog } = await build()
        bindings.handoversOf.mockResolvedValueOnce([loyaltyAgent, bookingAgent])
        await expect(modules.briefs(conversationOf())).resolves.toEqual([
            "LOYALTY FACTS",
            "bundle.loyaltyContract",
            "BOOKING RULES",
            "bundle.bookingAddendum",
        ])
        expect(booking.brief).toHaveBeenCalledWith(WS)
        expect(catalog.get).toHaveBeenCalledWith("bundle.bookingAddendum", {}, "vi")
    })

    it("uses the booking module's own contract while still adding loyalty facts", async () => {
        const { modules, bindings, booking, catalog } = await build()
        await expect(modules.briefs(conversationOf("booking"))).resolves.toEqual([
            "LOYALTY FACTS",
            "bundle.loyaltyContract",
            "BOOKING RULES",
        ])
        expect(bindings.handoversOf).not.toHaveBeenCalled()
        expect(booking.brief).toHaveBeenCalledWith(WS)
        expect(catalog.get).not.toHaveBeenCalledWith("bundle.bookingAddendum", {}, "vi")
    })

    it("uses the loyalty module's own contract", async () => {
        const { modules, bindings, catalog } = await build()
        bindings.handoversOf.mockResolvedValueOnce([loyaltyAgent])
        await expect(modules.briefs(conversationOf("loyalty"))).resolves.toEqual(["LOYALTY FACTS"])
        expect(bindings.handoversOf).toHaveBeenCalledWith("conn1", { module: "loyalty" })
        expect(catalog.get).not.toHaveBeenCalled()
    })

    it("leaves out empty loyalty and booking facts while preserving the booking addendum", async () => {
        const { modules, loyalty, bindings, booking, catalog } = await build()
        loyalty.brief.mockResolvedValueOnce("")
        booking.brief.mockResolvedValueOnce("")
        bindings.handoversOf.mockResolvedValueOnce([bookingAgent])
        await expect(modules.briefs(conversationOf())).resolves.toEqual(["bundle.bookingAddendum"])
        expect(catalog.get).not.toHaveBeenCalledWith("bundle.loyaltyContract", {}, "vi")
        expect(booking.brief).toHaveBeenCalledWith(WS)
    })

    it("returns no blocks when neither programme facts nor booking access exist", async () => {
        const { modules, loyalty, booking, catalog } = await build()
        loyalty.brief.mockResolvedValueOnce("")
        await expect(modules.briefs(conversationOf())).resolves.toEqual([])
        expect(booking.brief).not.toHaveBeenCalled()
        expect(catalog.get).not.toHaveBeenCalled()
    })
})

describe("TurnModulesService", () => {
    it("leaves a reply without module requests alone", async () => {
        const { modules, booking, loyalty, bindings, engine, evidence } = await build()
        await expect(modules.settle(ctx, turnOf(), replyOf())).resolves.toEqual({ reply: null, lines: [] })
        expect(booking.apply).not.toHaveBeenCalled()
        expect(loyalty.redeemIntent).not.toHaveBeenCalled()
        expect(bindings.handoversOf).not.toHaveBeenCalled()
        expect(engine.runWork).not.toHaveBeenCalled()
        expect(evidence.log).not.toHaveBeenCalled()
    })

    it("ignores a booking request when the agent cannot book or hand over to booking", async () => {
        const { modules, booking, bindings, evidence } = await build()
        bindings.handoversOf.mockResolvedValueOnce([loyaltyAgent])
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

describe("TurnModulesService", () => {
    it("does not open work for a reward that has no redeem intent", async () => {
        const { modules, loyalty, engine, evidence } = await build()
        await expect(modules.settle(ctx, turnOf(), replyOf({ loyaltyRewardKey: "missing" }))).resolves.toEqual({
            reply: null,
            lines: [],
        })
        expect(loyalty.redeemIntent).toHaveBeenCalledWith(customerRef, "missing")
        expect(engine.runWork).not.toHaveBeenCalled()
        expect(evidence.log).not.toHaveBeenCalled()
    })

    it("logs a blocked redemption without starting work or adding a line", async () => {
        const { modules, loyalty, engine, evidence, catalog } = await build()
        loyalty.redeemIntent.mockResolvedValueOnce({ ...openIntent, kind: "blocked", reason: "not_enough_points" })
        await expect(modules.settle(ctx, turnOf(), replyOf({ loyaltyRewardKey: reward.key }))).resolves.toEqual({
            reply: null,
            lines: [],
        })
        expect(loyalty.redeemIntent).toHaveBeenCalledWith(customerRef, reward.key)
        expect(catalog.get).toHaveBeenCalledWith(
            "customerTurns.redeemBlocked",
            { name: "Lan", reward: "Tea voucher", cost: "100", reason: "not_enough_points" },
            "vi",
        )
        expect(evidence.log).toHaveBeenCalledWith(ctx, {
            lead_id: "lead1",
            kind: "loyalty.redeem_blocked",
            actor: "OpenClaw",
            summary: "customerTurns.redeemBlocked",
            evidence: "m1",
        })
        expect(engine.runWork).not.toHaveBeenCalled()
    })
})

describe("TurnModulesService", () => {
    it("opens a preset gated redemption with message deduplication and the authoritative reward facts", async () => {
        const { modules, loyalty, engine, evidence, catalog } = await build()
        loyalty.redeemIntent.mockResolvedValueOnce(openIntent)
        await expect(modules.settle(ctx, turnOf(), replyOf({ loyaltyRewardKey: reward.key }))).resolves.toEqual({
            reply: null,
            lines: ["customerTurns.redeemAsked"],
        })
        expect(loyalty.redeemIntent).toHaveBeenCalledWith(customerRef, reward.key)
        expect(engine.runWork).toHaveBeenCalledWith(ctx, {
            action: "redeem_reward",
            subject_type: "conversation",
            subject_id: "c1",
            lead_id: "lead1",
            preset: true,
            noChain: true,
            dedupeKey: "redeem_reward:message:m1",
            seed: {
                summary: "performers.redeemSummary",
                amount_vnd: 50_000,
                fields: {
                    customer: "Lan",
                    customer_id: "customer1",
                    reward_id: "reward1",
                    reward: "Tea voucher",
                    amount_vnd: 50_000,
                    conversation_id: "c1",
                    source: "chat",
                },
            },
        })
        expect(catalog.get).toHaveBeenCalledWith(
            "performers.redeemSummary",
            { name: "Lan", reward: "Tea voucher", cost: "100" },
            "vi",
        )
        expect(catalog.get).toHaveBeenCalledWith(
            "customerTurns.redeemAsked",
            { name: "Lan", reward: "Tea voucher", cost: "100" },
            "vi",
        )
        expect(evidence.log).not.toHaveBeenCalled()
    })

    it("combines a booking answer with the redemption line from the same turn", async () => {
        const { modules, loyalty, booking, engine, evidence } = await build()
        loyalty.redeemIntent.mockResolvedValueOnce(openIntent)
        await expect(
            modules.settle(
                ctx,
                turnOf(conversationOf("booking")),
                replyOf({ bookingRequest: request, loyaltyRewardKey: reward.key }),
            ),
        ).resolves.toEqual({ reply: "Your appointment is requested", lines: ["customerTurns.redeemAsked"] })
        expect(booking.apply).toHaveBeenCalledTimes(1)
        expect(loyalty.redeemIntent).toHaveBeenCalledWith(customerRef, reward.key)
        expect(engine.runWork).toHaveBeenCalledTimes(1)
        expect(evidence.log).toHaveBeenCalledTimes(1)
    })
})

describe("TurnModulesService connectors", () => {
    const party = { found: true, partyId: "p1", name: "Lan" }
    const lead = { contactName: "Lan", company: "", need: "two nights", phone: "0900", email: null }

    it("adds the connector clause and the party for an agent holding connector grants", async () => {
        const { modules, connectors, loyalty } = await build()
        loyalty.brief.mockResolvedValueOnce("")
        connectors.servesConnectors.mockResolvedValue(true)
        connectors.partyOf.mockResolvedValue(party)
        await expect(modules.briefs(conversationOf())).resolves.toEqual(["CONNECTOR CLAUSE"])
        expect(connectors.partyOf).toHaveBeenCalledWith(conversationOf())
        expect(connectors.briefOf).toHaveBeenCalledWith(party)
    })

    it("adds no connector block for an agent without connector grants", async () => {
        const { modules, connectors, loyalty } = await build()
        loyalty.brief.mockResolvedValueOnce("")
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
