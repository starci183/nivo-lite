import { WS, catalog, turnOf, proposalOf } from "@tests/fixtures/builders/customer-outcomes.builder"
import { CustomerTurnsLogEvent } from "./customer-turns.log-events"
import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import type { Logger } from "@modules/platform/logging"
import { AgentBindingsService } from "@modules/domain/agent-connections"
import { AuthorityRulesService } from "@modules/domain/authority-rules"
import { AgentConversationsService } from "@modules/domain/agent-conversations"
import { KnowledgeGapNotesService } from "@modules/domain/agent-knowledge"
import { CommandBusService, EvidenceService, WorkEngineService } from "@modules/domain/decisions"
import type { WorkItem, WorkStatus } from "@modules/domain/decisions"
import { HiringPublicService } from "@modules/domain/hiring"
import { InboundEventsService } from "@modules/domain/inbound-events"
import { InvoicesService } from "@modules/domain/invoices"
import { WorkItemsService } from "@modules/domain/work-items"
import { CLOCK } from "@modules/platform/clock"
import type { MessageCatalog } from "@modules/platform/i18n"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import { LOGGER } from "@modules/platform/logging"
import { CustomerOutcomesService } from "./customer-outcomes.service"

import { findingsOf } from "./reply-reading.policy"
import { StaffEscalationService } from "./staff-escalation.service"
import { TurnModulesService } from "./turn-modules.service"
import { TurnPurchasesService } from "./turn-purchases.service"

const objectLike = (shape: Record<string, unknown>): unknown => expect.objectContaining(shape)

const engineOf = () => ({
    runWork: jest
        .fn<Promise<WorkItem>, Parameters<WorkEngineService["runWork"]>>()
        .mockResolvedValue(mock<WorkItem>({ id: "w1", status: "waiting_decision", lead_id: null })),
    startOrderWork: jest.fn().mockResolvedValue({ id: "w2", status: "done", lead_id: "l9" }),
    runQueued: jest.fn().mockResolvedValue(0),
})

const build = async () => {
    const engine = engineOf()
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
        recordClaim: jest.fn().mockResolvedValue(settled),
    }
    const conversations = { rename: jest.fn(), attachLead: jest.fn() }
    const gaps = { note: jest.fn().mockResolvedValue(undefined) }
    const modules = { settle: jest.fn().mockResolvedValue({ reply: null, lines: [] }) }
    const evidence = { log: jest.fn() }
    const items = { findByDedupe: jest.fn().mockResolvedValue(null) }
    const bindings = { agentsFor: jest.fn().mockResolvedValue([]) }
    const hiring = { registerChatApplication: jest.fn() }
    const staff = {
        escalate: jest.fn<Promise<boolean>, Parameters<StaffEscalationService["escalate"]>>().mockResolvedValue(true),
    }
    const catalogDouble = mock<MessageCatalog>(catalog)
    const logger = mock<Logger>({ info: jest.fn(), warn: jest.fn(), error: jest.fn() })
    const engineDouble = mock<WorkEngineService>(engine)
    const busDouble = mock<CommandBusService>(bus)
    const evidenceDouble = mock<EvidenceService>(evidence)
    const itemsDouble = mock<WorkItemsService>(items)
    const inboundDouble = mock<InboundEventsService>(inbound)
    const conversationsDouble = mock<AgentConversationsService>(conversations)
    const bindingsDouble = mock<AgentBindingsService>(bindings)
    const rules = { ruleFor: jest.fn().mockResolvedValue(null) }
    const rulesDouble = mock<AuthorityRulesService>(rules)
    const purchasesDouble = mock<TurnPurchasesService>(purchases)
    const staffDouble = mock<StaffEscalationService>(staff)
    const modulesDouble = mock<TurnModulesService>(modules)
    const moduleRef = await Test.createTestingModule({
        providers: [
            CustomerOutcomesService,
            { provide: MESSAGE_CATALOG, useValue: catalogDouble },
            { provide: CLOCK, useValue: new FakeClock("2026-10-13T10:00:00.000Z") },
            { provide: LOGGER, useValue: logger },
            { provide: WorkEngineService, useValue: engineDouble },
            { provide: CommandBusService, useValue: busDouble },
            { provide: EvidenceService, useValue: evidenceDouble },
            { provide: WorkItemsService, useValue: itemsDouble },
            { provide: InboundEventsService, useValue: inboundDouble },
            { provide: InvoicesService, useValue: mock<InvoicesService>(invoices) },
            { provide: AgentConversationsService, useValue: conversationsDouble },
            { provide: AgentBindingsService, useValue: bindingsDouble },
            { provide: AuthorityRulesService, useValue: rulesDouble },
            { provide: HiringPublicService, useValue: mock<HiringPublicService>(hiring) },
            { provide: TurnPurchasesService, useValue: purchasesDouble },
            { provide: StaffEscalationService, useValue: staffDouble },
            { provide: KnowledgeGapNotesService, useValue: mock<KnowledgeGapNotesService>(gaps) },
            { provide: TurnModulesService, useValue: modulesDouble },
        ],
    }).compile()
    return {
        outcomes: moduleRef.get(CustomerOutcomesService),
        engine,
        bus,
        inbound,
        invoices,
        purchases,
        gaps,
        modules,
        conversations,
        evidence,
        items,
        bindings,
        rules,
        hiring,
        staff,
        logger,
    }
}

describe("CustomerOutcomesService", () => {
    it("keeps a null judged reason and defaults it when opening a human reply", async () => {
        const { outcomes, engine } = await build()
        const turn = turnOf()
        const reply = { ...findingsOf({}), reply: "Thanks!", needsHuman: true, reason: null, proposedAnswer: null }
        const judged = await outcomes["judge"](turn.conversation, reply)
        expect(judged).toEqual({ reply: "Thanks!", needsHuman: true, reason: null, order: null, claimOpen: null })
        const lines = await outcomes["askPerson"](outcomes["ctxOf"](turn), turn, reply, judged, null)
        expect(lines).toEqual(["conversations.chatNeedsHuman"])
        expect(engine.runWork.mock.calls[0]?.[1]?.forceAsk).toBe("unclear_outcome")
    })

    it("hands the turn and wake of the core road to the item a held-over question opens, and nothing on the legacy road", async () => {
        const core = await build()
        const legacy = await build()
        const turn = turnOf()

        await core.outcomes.holdOver({ ...turn, origin: { turnId: "turn-1", wakeId: "wake-1" } }, "quota_exceeded")
        await legacy.outcomes.holdOver(turn, "quota_exceeded")

        expect(core.engine.runWork.mock.calls[0]?.[1]?.origin).toEqual({ turnId: "turn-1", wakeId: "wake-1" })
        expect(legacy.engine.runWork.mock.calls[0]?.[1]?.origin).toBeUndefined()
    })

    it.each<[WorkStatus, boolean, string | undefined]>([
        ["done", false, undefined],
        ["waiting_decision", true, "Lan"],
        ["waiting_decision", false, ""],
    ])("handles a %s reply decision with captured customer %s", async (status, captured, name) => {
        const { outcomes, engine, staff } = await build()
        engine.runWork.mockResolvedValue(mock<WorkItem>({ id: "w1", status, lead_id: null }))
        const turn = turnOf("l1")
        const unnamed = { ...turn, conversation: { ...turn.conversation, visitorName: null } }
        const lead = captured ? { contact_name: "Lan", need: "tea" } : null
        const verdict = await outcomes.settle(unnamed, proposalOf({ lead }, { needsHuman: true }))
        expect(verdict).toEqual({ reply: "Thanks!", send: true, lines: ["conversations.chatNeedsHuman"] })
        expect(engine.runWork.mock.calls[0]?.[1]?.forceAsk).toBe("unclear_outcome")
        expect(staff.escalate).toHaveBeenCalledTimes(status === "done" ? 0 : 1)
        expect(staff.escalate.mock.calls[0]?.[1]?.customerName).toBe(name)
    })

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

    it("takes an order at a price written in the knowledge", async () => {
        const known = await build()
        const verdict = await known.outcomes.settle(
            turnOf(),
            proposalOf({ order: { items: "Tra sua", amount_vnd: 50_000 } }),
        )
        expect(known.purchases.recordOrder).toHaveBeenCalledWith(
            expect.any(Object),
            expect.any(Object),
            expect.objectContaining({ order: { items: "Tra sua", amountVnd: 50_000 } }),
        )
        expect(verdict).toEqual({ reply: "Thanks!", send: true, lines: [] })
    })
})

describe("CustomerOutcomesService", () => {
    it("asks a person for an unknown order price and skips module requests", async () => {
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
        expect(unknown.modules.settle).not.toHaveBeenCalled()
    })

    it("answers a payment claim with fixed text and opens one check for the open invoice", async () => {
        const { outcomes, invoices, purchases } = await build()
        purchases.recordClaim.mockResolvedValueOnce({
            lines: ["customerTurns.claimRecorded"],
            changed: true,
            leadId: null,
        })
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
})

describe("CustomerOutcomesService", () => {
    it("notes the knowledge gap the reply named", async () => {
        const { outcomes, gaps } = await build()
        await outcomes.settle(
            turnOf(),
            proposalOf({ knowledge_gap: { question: "Open Sunday?", topic: "Hours | Sunday" } }),
        )
        expect(gaps.note).toHaveBeenCalledWith(
            expect.objectContaining({
                signals: objectLike({
                    knowledgeGap: { question: "Open Sunday?", topic: "Hours | Sunday" },
                }),
            }),
        )
    })

    it("passes the parsed booking and loyalty findings to the turn modules", async () => {
        const { outcomes, modules } = await build()
        const turn = turnOf("l1")
        const verdict = await outcomes.settle(
            turn,
            proposalOf({
                booking_request: {
                    intent: "book",
                    service: "Haircut",
                    date: "2026-10-15",
                    time: "9:00",
                    party_size: 2,
                    contact_name: "Lan",
                    phone: "0900",
                },
                loyalty: { intent: "redeem", reward_key: "tea-voucher" },
            }),
        )
        expect(modules.settle).toHaveBeenCalledWith({ workspaceId: WS, actor: "OpenClaw", locale: "vi" }, turn, {
            reply: "Thanks!",
            needsHuman: false,
            reason: null,
            proposedAnswer: null,
            lead: null,
            order: null,
            paymentClaim: false,
            knowledgeGap: null,
            application: null,
            loyaltyRewardKey: "tea-voucher",
            bookingRequest: {
                intent: "book",
                service: "Haircut",
                date: "2026-10-15",
                time: "09:00",
                from: null,
                to: null,
                partySize: 2,
                name: "Lan",
                phone: "0900",
                email: null,
                note: null,
            },
        })
        expect(verdict).toEqual({ reply: "Thanks!", send: true, lines: [] })
    })
})

describe("CustomerOutcomesService", () => {
    it("uses a module's booking reply in place of the model's reply", async () => {
        const { outcomes, modules, engine } = await build()
        modules.settle.mockResolvedValueOnce({ reply: "Your appointment is requested", lines: [] })
        const verdict = await outcomes.settle(turnOf(), proposalOf({ booking_request: { intent: "book" } }))
        expect(verdict).toEqual({ reply: "Your appointment is requested", send: true, lines: [] })
        expect(modules.settle).toHaveBeenCalledTimes(1)
        expect(engine.runQueued).not.toHaveBeenCalled()
    })

    it("adds a module's redemption line and drains the new work while retaining the model's reply", async () => {
        const { outcomes, modules, engine, gaps } = await build()
        modules.settle.mockResolvedValueOnce({ reply: null, lines: ["customerTurns.redeemAsked"] })
        const verdict = await outcomes.settle(
            turnOf(),
            proposalOf({ loyalty: { intent: "redeem", reward_key: "tea-voucher" } }),
        )
        expect(verdict).toEqual({ reply: "Thanks!", send: true, lines: ["customerTurns.redeemAsked"] })
        expect(engine.runQueued).toHaveBeenCalledWith({ workspaceId: WS, actor: "OpenClaw", locale: "vi" }, 2)
        expect(gaps.note).toHaveBeenCalledWith(objectLike({ signals: objectLike({ isTransaction: true }) }))
    })

    it("leaves booking and redemption for a person when the proposal needs a human answer", async () => {
        const { outcomes, modules, engine } = await build()
        const verdict = await outcomes.settle(
            turnOf(),
            proposalOf(
                { booking_request: { intent: "book" }, loyalty: { intent: "redeem", reward_key: "tea-voucher" } },
                { needsHuman: true, reason: "over_authority", proposedAnswer: "Please check the request" },
            ),
        )
        expect(modules.settle).not.toHaveBeenCalled()
        expect(engine.runWork).toHaveBeenCalledWith(
            { workspaceId: WS, actor: "OpenClaw", locale: "vi" },
            expect.objectContaining({
                action: "reply_customer",
                forceAsk: "over_authority",
                dedupeKey: "reply_customer:message:m1",
                seed: objectLike({ draft: "Please check the request" }),
            }),
        )
        expect(verdict).toEqual({ reply: "Thanks!", send: true, lines: ["conversations.chatNeedsHuman"] })
    })

    it.each([
        [true, "customerTurns.applicationStored", "Thanks!"],
        [false, "customerTurns.applicationNotStored", "customerTurns.applicationRefusedReply"],
    ])("stores a chat application when hiring accepts it: %s", async (ok, line, reply) => {
        const { outcomes, hiring } = await build()
        const register = hiring.registerChatApplication
        register.mockResolvedValue(ok ? { ok: true } : { ok: false, message: "closed" })
        const application = { job: "barista", name: "Lan", phone: "0912", email: "", consent: true }
        const verdict = await outcomes.settle(turnOf(), proposalOf({ application }))
        expect(verdict.lines).toContain(line)
        expect(register).toHaveBeenCalledWith(WS, "c1", expect.objectContaining({ job: "barista" }))
        expect(verdict.reply).toBe(reply)
    })
})

describe("CustomerOutcomesService", () => {
    it("holds a website reply when the owner's reply rule asks first and sends it when the rule is auto", async () => {
        const { outcomes, rules } = await build()
        rules.ruleFor.mockResolvedValue({ mode: "ask" })
        await expect(outcomes.settle(turnOf(), proposalOf({}))).resolves.toMatchObject({ send: false })
        rules.ruleFor.mockResolvedValue({ mode: "auto" })
        await expect(outcomes.settle(turnOf(), proposalOf({}))).resolves.toMatchObject({ send: true })
    })

    it("holds the reply for approval when the connection access is ask", async () => {
        const { outcomes, bindings, staff, engine } = await build()
        bindings.agentsFor.mockResolvedValue([{ id: "a1", access: "ask" }])
        const turn = turnOf()
        const asking = { ...turn, conversation: { ...turn.conversation, connectionId: "conn-1" } }
        const verdict = await outcomes.settle(asking, proposalOf({}))
        expect(verdict.send).toBe(false)
        expect(verdict.lines).toEqual(["customerTurns.replyAwaitsApproval"])
        expect(staff.escalate).toHaveBeenCalled()
        engine.runWork.mockResolvedValue(mock<WorkItem>({ id: "w1", status: "done", lead_id: null }))
        bindings.agentsFor.mockResolvedValue([{ id: "other", access: "read" }])
        await expect(outcomes.settle(asking, proposalOf({}))).resolves.toMatchObject({ send: true })
        bindings.agentsFor.mockResolvedValue([{ id: "a1", access: "auto" }])
        await expect(outcomes.settle(asking, proposalOf({}))).resolves.toMatchObject({ send: true })
    })

    it("confirms a payment that was just recorded and asks a person when nothing matches", async () => {
        const recent = await build()
        recent.invoices.latestOfLead.mockResolvedValueOnce(null).mockResolvedValueOnce({
            id: "inv-2",
            invoice_no: "HD-02",
            paid_at: "2026-10-12T10:00:00.000Z",
        })
        await expect(recent.outcomes.settle(turnOf("l1"), proposalOf({ payment_claim: true }))).resolves.toMatchObject({
            reply: "customerTurns.paymentConfirmedReply",
            send: true,
        })

        const stale = await build()
        stale.invoices.latestOfLead.mockResolvedValueOnce(null).mockResolvedValueOnce({
            id: "inv-3",
            invoice_no: "HD-03",
            paid_at: "2020-01-01T00:00:00.000Z",
        })
        const looked = await stale.outcomes.settle(turnOf("l1"), proposalOf({ payment_claim: true }))
        expect(looked.lines).toContain("conversations.chatNeedsHuman")

        const unknown = await build()
        await expect(unknown.outcomes.settle(turnOf(), proposalOf({ payment_claim: true }))).resolves.toMatchObject({
            lines: ["conversations.chatNeedsHuman"],
        })
        expect(unknown.invoices.latestOfLead).not.toHaveBeenCalled()
    })

    it("does not hand off a duplicate lead and asks when the gate is not finished", async () => {
        const duplicate = await build()
        duplicate.inbound.recordInput.mockResolvedValue({ duplicate: true, inboundEventId: "e1" })
        await duplicate.outcomes.settle(
            turnOf(),
            proposalOf({ lead: { contact_name: "Lan", need: "tea", email: "lan@example.com" } }),
        )
        expect(duplicate.bus.sendCommandItem).not.toHaveBeenCalled()

        const asking = await build()
        asking.bus.sendCommandItem.mockResolvedValue({
            id: "w3",
            status: "waiting_decision",
            lead_id: null,
            reason: null,
        })
        const verdict = await asking.outcomes.settle(
            turnOf(),
            proposalOf({ lead: { contact_name: "Lan", need: "tea", email: "lan@example.com" } }),
        )
        expect(verdict.lines).toContain("customerTurns.chatHandoffWaiting")
        expect(verdict.lines).not.toContain("customerTurns.chatHandoff")
        expect(asking.conversations.attachLead).not.toHaveBeenCalled()
        expect(asking.conversations.rename).toHaveBeenCalledWith("c1", "Lan")
    })
})

describe("CustomerOutcomesService", () => {
    it("does not open a second waiting answer or escalate a decision that is already closed", async () => {
        const existed = await build()
        existed.items.findByDedupe.mockResolvedValue({ id: "old" })
        const verdict = await existed.outcomes.settle(
            turnOf(),
            proposalOf({}, { needsHuman: true, reason: "", proposedAnswer: "  draft  " }),
        )
        expect(verdict.lines).toEqual([])
        expect(existed.staff.escalate).not.toHaveBeenCalled()

        const closed = await build()
        closed.engine.runWork.mockResolvedValue(mock<WorkItem>({ id: "w1", status: "done", lead_id: null }))
        await closed.outcomes.holdOver(turnOf(), "openclaw_unavailable")
        expect(closed.staff.escalate).not.toHaveBeenCalled()
        expect(closed.evidence.log).toHaveBeenCalledWith(
            expect.any(Object),
            expect.objectContaining({ kind: "engine.fallback", evidence: "m1" }),
        )
    })

    it("drains three steps after an order and logs a drain that cannot run", async () => {
        const ordered = await build()
        ordered.purchases.recordOrder.mockResolvedValue({
            lines: ["customerTurns.orderRecorded"],
            changed: true,
            leadId: "l9",
        })
        const turn = turnOf()
        const web = { ...turn, conversation: { ...turn.conversation, channel: "sms" } }
        const verdict = await ordered.outcomes.settle(
            web,
            proposalOf({ order: { items: "Tra sua", amount_vnd: 50_000 } }),
        )
        expect(verdict.lines).toContain("customerTurns.orderRecorded")
        expect(ordered.engine.runQueued).toHaveBeenCalledWith(expect.objectContaining({ locale: "vi" }), 3)

        const broken = await build()
        const cause = new Error("queue down")
        broken.engine.runQueued.mockRejectedValue(cause)
        broken.purchases.recordOrder.mockResolvedValue({ lines: [], changed: true, leadId: null })
        await broken.outcomes.settle(turnOf(), proposalOf({ order: { items: "Tra sua", amount_vnd: 50_000 } }))
        expect(broken.logger.error).toHaveBeenCalledWith(CustomerTurnsLogEvent.DrainFailed, cause, { workspaceId: WS })
    })
})
