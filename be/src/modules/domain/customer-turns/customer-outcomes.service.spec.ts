import { arrangeCustomerOutcomes } from "@tests/fixtures/builders/customer-outcomes-harness.builder"
import {
    WS,
    turnOf,
    proposalOf,
    replyDecisionCases,
    customerReplyGraphCases,
    CUSTOMER_OUTCOME_EXPECTED as EXPECTED,
    customerPaymentInvoices,
    customerRuleOf,
    customerBindingOf,
    customerWorkItemOf,
    catalog as catalogData,
    bookingCase,
} from "@tests/fixtures/builders/customer-outcomes.builder"
import { CustomerTurnsLogEvent } from "./customer-turns.log-events"

import { FakeClock, mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { AgentBindingsService } from "@modules/domain/agent-connections"
import { AuthorityRulesService } from "@modules/domain/authority-rules"
import { AgentConversationsService } from "@modules/domain/agent-conversations"
import { KnowledgeGapNotesService } from "@modules/domain/agent-knowledge"
import { CommandBusService, EvidenceService, WorkEngineService } from "@modules/domain/decisions"
import { HiringPublicService } from "@modules/domain/hiring"
import { InboundEventsService } from "@modules/domain/inbound-events"
import { InvoicesService } from "@modules/domain/invoices"
import { WorkItemsService } from "@modules/domain/work-items"
import { CLOCK } from "@modules/platform/clock"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { CustomerOutcomesService } from "./customer-outcomes.service"
import { StaffEscalationService } from "./staff-escalation.service"
import { TurnModulesService } from "./turn-modules.service"
import { TurnPurchasesService } from "./turn-purchases.service"

import type { WorkItem } from "@modules/domain/decisions"

import { findingsOf } from "./reply-reading.policy"

const objectLike = (shape: Record<string, unknown>): unknown => expect.objectContaining(shape)
const matching = (pattern: RegExp): unknown => expect.stringMatching(pattern)

const build = async () => {
    const engine = mock<WorkEngineService>()
    const bus = mock<CommandBusService>()
    const inbound = mock<InboundEventsService>()
    const invoices = mock<InvoicesService>()
    const purchases = mock<TurnPurchasesService>()
    purchases.recordOrderClaim.mockResolvedValue({ lines: [], changed: false, leadId: null })
    purchases.awaitsPayment.mockResolvedValue(false)
    const gaps = mock<KnowledgeGapNotesService>()
    const modules = mock<TurnModulesService>()
    const conversations = mock<AgentConversationsService>()
    const evidence = mock<EvidenceService>()
    const items = mock<WorkItemsService>()
    const bindings = mock<AgentBindingsService>()
    const rules = mock<AuthorityRulesService>()
    const hiring = mock<HiringPublicService>()
    const staff = mock<StaffEscalationService>()
    const logger = mock<Logger>()
    const catalog = mock<MessageCatalog>(catalogData)
    const doubles = {
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
        catalog,
    }
    arrangeCustomerOutcomes(doubles)
    const moduleRef = await Test.createTestingModule({
        providers: [
            CustomerOutcomesService,
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: CLOCK, useValue: new FakeClock("2026-10-13T10:00:00.000Z") },
            { provide: LOGGER, useValue: logger },
            { provide: WorkEngineService, useValue: engine },
            { provide: CommandBusService, useValue: bus },
            { provide: EvidenceService, useValue: evidence },
            { provide: WorkItemsService, useValue: items },
            { provide: InboundEventsService, useValue: inbound },
            { provide: InvoicesService, useValue: invoices },
            { provide: AgentConversationsService, useValue: conversations },
            { provide: AgentBindingsService, useValue: bindings },
            { provide: AuthorityRulesService, useValue: rules },
            { provide: HiringPublicService, useValue: hiring },
            { provide: TurnPurchasesService, useValue: purchases },
            { provide: StaffEscalationService, useValue: staff },
            { provide: KnowledgeGapNotesService, useValue: gaps },
            { provide: TurnModulesService, useValue: modules },
        ],
    }).compile()
    return { outcomes: moduleRef.get(CustomerOutcomesService), ...doubles }
}

describe("CustomerOutcomesService final replies", () => {
    it("judges a reply written after the turn by the same gate, keyed by what it answers", async () => {
        const { outcomes, engine } = await build()
        await expect(outcomes.settleLate(turnOf(), "Drafted ORD-1", "w1")).resolves.toEqual(EXPECTED.lateReply)
        expect(engine.checkGraph).toHaveBeenCalledWith(
            expect.objectContaining({ road: "reply", text: "Drafted ORD-1", key: matching(/^w1:/u) }),
        )
    })

    it("does not judge the model's text of a turn whose final reply is owed", async () => {
        const { outcomes, engine } = await build()
        await outcomes.settle({ ...turnOf(), finalOwed: true }, proposalOf({}, { reply: "Will do" }))
        expect(engine.checkGraph).not.toHaveBeenCalled()
    })
})

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

    it.each(replyDecisionCases)(
        "handles a %s reply decision with captured customer %s",
        async (status, captured, name) => {
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
        },
    )

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
        invoices.latestOfLead.mockResolvedValueOnce(customerPaymentInvoices.claimed)
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

    it("answers a payment claim for an order that waits for money with a neutral reply, keeps the claim and asks no person", async () => {
        const { outcomes, invoices, purchases } = await build()
        invoices.latestOfLead.mockResolvedValue(null)
        purchases.awaitsPayment.mockResolvedValueOnce(true)
        purchases.recordOrderClaim.mockResolvedValueOnce({
            lines: ["customerTurns.orderClaimRecorded"],
            changed: true,
            leadId: "l1",
        })
        const verdict = await outcomes.settle(turnOf("l1"), proposalOf({ payment_claim: true }, { reply: "Paid!" }))
        expect(verdict.reply).toBe("customerTurns.orderClaimReply")
        expect(purchases.recordOrderClaim).toHaveBeenCalledWith(expect.any(Object), expect.any(Object), true)
        expect(verdict.lines).toContain("customerTurns.orderClaimRecorded")
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
        const verdict = await outcomes.settle(turn, proposalOf(bookingCase.detail))
        expect(modules.settle).toHaveBeenCalledWith(
            { workspaceId: WS, actor: "OpenClaw", locale: "vi" },
            turn,
            bookingCase.findings,
        )
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
        register.mockResolvedValue(ok ? { ok: true, message: "stored" } : { ok: false, message: "closed" })
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
        rules.ruleFor.mockResolvedValue(customerRuleOf({ mode: "ask" }))
        await expect(outcomes.settle(turnOf(), proposalOf({}))).resolves.toMatchObject({ send: false })
        rules.ruleFor.mockResolvedValue(customerRuleOf({ mode: "auto" }))
        await expect(outcomes.settle(turnOf(), proposalOf({}))).resolves.toMatchObject({ send: true })
    })

    it("holds the reply for approval when the connection access is ask", async () => {
        const { outcomes, bindings, staff, engine } = await build()
        bindings.agentsFor.mockResolvedValue([customerBindingOf()])
        const turn = turnOf()
        const asking = { ...turn, conversation: { ...turn.conversation, connectionId: "conn-1" } }
        const verdict = await outcomes.settle(asking, proposalOf({}))
        expect(verdict.send).toBe(false)
        expect(verdict.lines).toEqual(["customerTurns.replyAwaitsApproval"])
        expect(staff.escalate).toHaveBeenCalled()
        engine.runWork.mockResolvedValue(mock<WorkItem>({ id: "w1", status: "done", lead_id: null }))
        bindings.agentsFor.mockResolvedValue([customerBindingOf({ id: "other", access: "read" })])
        await expect(outcomes.settle(asking, proposalOf({}))).resolves.toMatchObject({ send: true })
        bindings.agentsFor.mockResolvedValue([customerBindingOf({ id: "a1", access: "auto" })])
        await expect(outcomes.settle(asking, proposalOf({}))).resolves.toMatchObject({ send: true })
    })

    it("confirms a payment that was just recorded and asks a person when nothing matches", async () => {
        const recent = await build()
        recent.invoices.latestOfLead.mockResolvedValueOnce(null).mockResolvedValueOnce(customerPaymentInvoices.recent)
        await expect(recent.outcomes.settle(turnOf("l1"), proposalOf({ payment_claim: true }))).resolves.toMatchObject({
            reply: "customerTurns.paymentConfirmedReply",
            send: true,
        })

        const stale = await build()
        stale.invoices.latestOfLead.mockResolvedValueOnce(null).mockResolvedValueOnce(customerPaymentInvoices.stale)
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
        asking.bus.sendCommandItem.mockResolvedValue(
            customerWorkItemOf({
                id: "w3",
                status: "waiting_decision",
                lead_id: null,
                reason: null,
            }),
        )
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
        existed.items.findByDedupe.mockResolvedValue(customerWorkItemOf({ id: "old" }))
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

describe("CustomerOutcomesService the graph of the agent on the reply", () => {
    const { ASK, found, order, askCases, stopCases } = customerReplyGraphCases()

    it("judges the text that really leaves, a module's answer in place of the model's, and holds it when the graph asks", async () => {
        const { outcomes, modules, engine, purchases, staff } = await build()
        engine.checkGraph.mockResolvedValue(ASK)
        purchases.recordOrder.mockResolvedValue(found)
        modules.settle.mockResolvedValueOnce({ reply: "Your appointment is requested", lines: [] })

        await expect(outcomes.settle(turnOf("l1"), order)).resolves.toEqual(EXPECTED.heldModuleReply)

        const text = "Your appointment is requested"
        expect(engine.checkGraph).toHaveBeenCalledWith(objectLike({ road: "reply", leadId: "l1", text }))
        const evidence = [{ key: "amount_vnd", value: 50_000, kind: "claimed", via: "order_record" }]
        const seed = objectLike({ draft: text, evidence })
        const spec = objectLike({ dedupeKey: "reply_customer:graph:m1", forceAsk: "branch_ask", seed })
        expect(engine.runWork).toHaveBeenCalledWith(expect.any(Object), spec)
        expect(staff.escalate).toHaveBeenCalledTimes(1)
    })

    it.each(askCases)("asks the staff nothing more when %s", async (_label, existing, status) => {
        const { outcomes, engine, items, staff } = await build()
        engine.checkGraph.mockResolvedValue({ ...ASK, unread: [] })
        items.findByDedupe.mockResolvedValue(existing)
        engine.runWork.mockResolvedValue(mock<WorkItem>({ id: "w1", status, lead_id: null }))

        await expect(outcomes.settle(turnOf(), proposalOf({}))).resolves.toMatchObject({ send: false })
        expect(staff.escalate).not.toHaveBeenCalled()
    })

    it.each(stopCases)("sends nothing when the graph %s", async (_label, answer, word, core) => {
        const { outcomes, engine } = await build()
        engine.checkGraph.mockResolvedValue(answer)
        const turn = core ? { ...turnOf("l1"), origin: { turnId: "t1", wakeId: "w1" } } : turnOf("l1")
        const verdict = await outcomes.settle(turn, proposalOf({}))

        expect(verdict).toEqual({ reply: "Thanks!", send: false, lines: [`customerTurns.reply${word}ByGraph`] })
        expect(engine.runDiverted).toHaveBeenCalledTimes(word === "Diverted" ? 1 : 0)
        expect(engine.runWork).not.toHaveBeenCalled()
    })
})
