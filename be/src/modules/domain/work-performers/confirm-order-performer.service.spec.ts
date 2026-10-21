import { builder, mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { AgentsService } from "@modules/domain/agents"
import { AutomationBusinessEventsService, BusinessEventsService } from "@modules/domain/automations"
import { EvidenceService } from "@modules/domain/decisions"
import type { Proposal, WorkContext, WorkItem } from "@modules/domain/decisions"
import { InboundEventsService } from "@modules/domain/inbound-events"
import type { OptionalInboundEvent } from "@modules/domain/inbound-events"
import { LeadRecordsService } from "@modules/domain/leads"
import type { LeadRecordRow } from "@modules/domain/leads"
import { OrdersService } from "@modules/domain/orders"
import type { OptionalOrder } from "@modules/domain/orders"
import { ResponsibilityJournalService } from "@modules/domain/responsibilities"
import { ConfirmOrderPerformerService } from "./confirm-order-performer.service"
import { WorkPerformersErrorCode } from "./errors/work-performers.error"
import { PerformerKitService } from "./performer-kit.service"
import { PROMPT_WRITER } from "./work-performers.decorators"
import type { PromptWriter } from "./work-performers.port"

const ctx: WorkContext = { workspaceId: "ws-1", actor: "Lan", locale: "en" }

const itemOf = builder<WorkItem>({
    id: "item-1",
    workspace_id: "ws-1",
    department: "sales",
    action: "confirm_order",
    subject_type: "order",
    subject_id: "ord-1",
    lead_id: "lead-1",
    inbound_event_id: null,
    parent_id: null,
    chain_id: "item-1",
    depth: 0,
    status: "queued",
    decided_path: null,
    reason: null,
    reasons: [],
    missing_fields: [],
    proposal: { summary: "Order", fields: { items: "2 tea boxes", amount_vnd: 300000 } },
    result: null,
    error: null,
    evidence_state: "pending",
    assigned_staff_id: null,
    execution_id: null,
    created_at: "2026-10-12T09:00:00.000Z",
    updated_at: "2026-10-12T09:00:00.000Z",
    completed_at: null,
    installation_id: null,
})

const leadOf = builder<LeadRecordRow>({
    id: "lead-1",
    workspace_id: "ws-1",
    contact_name: "Lan",
    company: "Hue Tea",
    channel: "Telegram",
    need: "tea",
    stage: "proposal",
    context_summary: null,
    phone: "84901234567",
    email: null,
})

const orderOf = builder<NonNullable<OptionalOrder>>({
    id: "ord-1",
    workspace_id: "ws-1",
    lead_id: "lead-1",
    inbound_event_id: null,
    order_no: "SO-1",
    items: "2 tea boxes",
    amount_vnd: 300000,
    status: "draft",
    confirmed_by: null,
    confirmed_at: null,
    created_at: "2026-10-12T09:00:00.000Z",
    shipped_at: null,
    carrier: null,
    tracking_code: null,
})

const eventOf = builder<NonNullable<OptionalInboundEvent>>({
    id: "ev-1",
    workspace_id: "ws-1",
    channel: "telegram",
    kind: "order",
    sender_name: "Lan",
    sender_contact: "0901234567",
    body: " 2 boxes of tea please ",
    amount_vnd: null,
    external_ref: " REF-1 ",
    event_id: "tg:1",
    lead_id: null,
    status: "new",
})

const proposalOf = (fields: Proposal["fields"], amount?: number | null): Proposal => ({
    summary: "Order",
    amount_vnd: amount,
    fields,
})

const build = async () => {
    const kit = mock<PerformerKitService>()
    kit.text.mockImplementation((_ctx, key, params = {}) => [key, ...Object.values(params).map(String)].join("|"))
    kit.money.mockImplementation((_ctx, amount) =>
        amount === null || amount === undefined ? "no amount" : `${amount} VND`,
    )
    kit.scope.mockReturnValue({ workspaceId: "ws-1", locale: "en" })
    kit.department.mockResolvedValue("Chatbot")
    const orders = mock<OrdersService>()
    orders.find.mockResolvedValue(orderOf())
    orders.draft.mockResolvedValue(orderOf({ id: "ord-2", order_no: "SO-2" }))
    const leads = mock<LeadRecordsService>()
    leads.require.mockResolvedValue(leadOf())
    leads.match.mockResolvedValue(null)
    leads.capture.mockResolvedValue(leadOf({ id: "lead-2", contact_name: "notShared", channel: "channel.zalo" }))
    const inbound = mock<InboundEventsService>()
    const agents = mock<AgentsService>()
    const responsibilities = mock<ResponsibilityJournalService>()
    const writer = mock<PromptWriter>()
    writer.extractOrder.mockResolvedValue({ items: "2 tea boxes", amount_vnd: 280000, confidence: 0.9 })
    const evidence = mock<EvidenceService>()
    const events = mock<BusinessEventsService>()
    const automationEvents = mock<AutomationBusinessEventsService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            ConfirmOrderPerformerService,
            { provide: PerformerKitService, useValue: kit },
            { provide: OrdersService, useValue: orders },
            { provide: LeadRecordsService, useValue: leads },
            { provide: InboundEventsService, useValue: inbound },
            { provide: AgentsService, useValue: agents },
            { provide: ResponsibilityJournalService, useValue: responsibilities },
            { provide: PROMPT_WRITER, useValue: writer },
            { provide: EvidenceService, useValue: evidence },
            { provide: BusinessEventsService, useValue: events },
            { provide: AutomationBusinessEventsService, useValue: automationEvents },
        ],
    }).compile()
    return {
        service: moduleRef.get(ConfirmOrderPerformerService),
        orders,
        leads,
        inbound,
        agents,
        responsibilities,
        writer,
        evidence,
        events,
        automationEvents,
    }
}

describe("ConfirmOrderPerformerService prepare", () => {
    it("reuses the drafted order of the item and the customer it names", async () => {
        const { service, orders, writer, inbound } = await build()

        await expect(service.prepare(ctx, itemOf())).resolves.toEqual({
            proposal: {
                summary: "orderSummary|SO-1|Lan|2 tea boxes|300000 VND",
                amount_vnd: 300000,
                fields: { customer: "Lan", items: "2 tea boxes", amount_vnd: 300000, order_no: "SO-1" },
            },
            patch: { subject_type: "order", subject_id: "ord-1", lead_id: "lead-1" },
        })
        expect(orders.draft).not.toHaveBeenCalled()
        expect(writer.extractOrder).not.toHaveBeenCalled()
        expect(inbound.mark).not.toHaveBeenCalled()
    })

    it("reads the input order, matches its sender and drafts under the input reference", async () => {
        const { service, orders, leads, inbound, writer } = await build()
        inbound.find.mockResolvedValue(eventOf())
        leads.match.mockResolvedValue(leadOf())
        const item = itemOf({
            subject_type: "inbound",
            subject_id: "ev-1",
            lead_id: null,
            inbound_event_id: "ev-1",
            proposal: { summary: "Order", fields: {} },
        })

        await expect(service.prepare(ctx, item)).resolves.toEqual({
            proposal: {
                summary: "orderSummary|SO-2|Lan|2 tea boxes|280000 VND",
                amount_vnd: 280000,
                fields: { customer: "Lan", items: "2 tea boxes", amount_vnd: 280000, order_no: "SO-2" },
            },
            patch: { subject_type: "order", subject_id: "ord-2", lead_id: "lead-1" },
        })
        expect(writer.extractOrder).toHaveBeenCalledWith(
            { workspaceId: "ws-1", locale: "en" },
            " 2 boxes of tea please ",
        )
        expect(leads.match).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            phone: "84901234567",
            email: null,
            name: "Lan",
            channel: "channel.telegram",
        })
        expect(orders.draft).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            leadId: "lead-1",
            inboundEventId: "ev-1",
            orderNo: "REF-1",
            items: "2 tea boxes",
            amountVnd: 280000,
        })
        expect(inbound.mark).toHaveBeenCalledWith("ws-1", "ev-1", null, "lead-1")
    })
})

describe("ConfirmOrderPerformerService prepare", () => {
    it.each([null, "", undefined])("captures unnamed sender %p and logs it", async (senderName) => {
        const { service, orders, leads, inbound, agents, responsibilities, evidence, events } = await build()
        inbound.find.mockResolvedValue(eventOf({ sender_name: senderName, sender_contact: null, amount_vnd: 150000 }))
        agents.agentOfDepartment.mockResolvedValue({ id: "agent-1", name: "Mai" })
        const item = itemOf({
            subject_type: "inbound",
            lead_id: null,
            inbound_event_id: "ev-1",
            proposal: { summary: "Order", fields: { order_no: "SO-77" } },
        })

        const prepared = await service.prepare(ctx, item)

        expect(prepared.proposal.amount_vnd).toBe(150000)
        expect(prepared.proposal.fields.items).toBe("2 boxes of tea please")
        expect(leads.capture).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            contactName: "notShared",
            company: "notShared",
            channel: "channel.telegram",
            need: "2 boxes of tea please",
            phone: null,
            email: null,
        })
        expect(responsibilities.ensureFor).toHaveBeenCalledWith(ctx, "lead-2")
        expect(events.leadCreated).toHaveBeenCalledWith("ws-1", expect.objectContaining({ id: "lead-2" }))
        expect(evidence.log).toHaveBeenCalledWith(ctx, {
            lead_id: "lead-2",
            work_item_id: "item-1",
            kind: "lead.captured",
            actor: "Mai",
            summary: "capturedFrom|channel.zalo",
            evidence: " 2 boxes of tea please ",
        })
        expect(orders.draft.mock.calls[0]?.[0].orderNo).toBe("SO-77")
    })

    it("drafts an order without number, goods or amount when nothing was given", async () => {
        const { service, orders, leads, writer, evidence } = await build()
        const item = itemOf({
            subject_type: "lead",
            lead_id: null,
            proposal: { summary: "Order", fields: {} },
        })

        const prepared = await service.prepare(ctx, item)

        expect(writer.extractOrder).not.toHaveBeenCalled()
        expect(prepared.proposal.summary).toBe("orderSummary|SO-2|notShared|—|no amount")
        expect(leads.capture.mock.calls[0]?.[0].contactName).toBe("notShared")
        expect(leads.capture.mock.calls[0]?.[0]).toMatchObject({ channel: "—", need: "—" })
        expect(evidence.log.mock.calls[0]?.[1]).toMatchObject({ actor: "Chatbot", evidence: null })
        expect(orders.draft.mock.calls[0]?.[0]).toMatchObject({ orderNo: null, items: "", amountVnd: null })
    })

    it("drafts a new order when the item's order is gone", async () => {
        const { service, orders } = await build()
        orders.find.mockResolvedValue(null)

        const prepared = await service.prepare(ctx, itemOf())

        expect(prepared.patch?.subject_id).toBe("ord-2")
    })
})

describe("ConfirmOrderPerformerService prepare", () => {
    it("drafts an order directly when the item has no subject id", async () => {
        const { service, orders } = await build()

        const prepared = await service.prepare(ctx, itemOf({ subject_id: null }))

        expect(prepared.patch).toEqual({ subject_type: "order", subject_id: "ord-2", lead_id: "lead-1" })
        expect(orders.find).not.toHaveBeenCalled()
        expect(orders.draft).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            leadId: "lead-1",
            inboundEventId: null,
            orderNo: null,
            items: "2 tea boxes",
            amountVnd: 300000,
        })
    })

    it("captures an empty input without model extraction or message evidence", async () => {
        const { service, inbound, leads, writer, evidence } = await build()
        inbound.find.mockResolvedValue(eventOf({ body: "" }))

        const prepared = await service.prepare(
            ctx,
            itemOf({
                subject_type: "inbound",
                lead_id: null,
                inbound_event_id: "ev-1",
                proposal: { summary: "Order", fields: {} },
            }),
        )

        expect(prepared.patch).toEqual({ subject_type: "order", subject_id: "ord-2", lead_id: "lead-2" })
        expect(leads.capture.mock.calls[0]?.[0].contactName).toBe("Lan")
        expect(writer.extractOrder).not.toHaveBeenCalled()
        expect(evidence.log).toHaveBeenCalledWith(ctx, {
            lead_id: "lead-2",
            work_item_id: "item-1",
            kind: "lead.captured",
            actor: "Chatbot",
            summary: "capturedFrom|channel.zalo",
            evidence: null,
        })
    })
})

describe("ConfirmOrderPerformerService perform", () => {
    it("confirms the draft, marks the deal won and leaves the evidence line", async () => {
        const { service, orders, leads, evidence } = await build()
        orders.confirm.mockResolvedValue(orderOf({ status: "confirmed" }))

        await expect(
            service.perform(ctx, itemOf(), proposalOf({ items: "2 tea boxes" }, 300000), { name: "Mai" }),
        ).resolves.toEqual({
            summary: "orderConfirmed|SO-1|300000 VND",
            evidence: "captured",
            href: "/leads/lead-1",
            lead_id: "lead-1",
        })
        expect(orders.confirm).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            orderId: "ord-1",
            amountVnd: 300000,
            items: "2 tea boxes",
            confirmedBy: "Mai",
        })
        expect(leads.markWon).toHaveBeenCalledWith("ws-1", "lead-1")
        expect(evidence.log).toHaveBeenCalledWith(ctx, {
            lead_id: "lead-1",
            work_item_id: "item-1",
            kind: "order.confirmed",
            actor: "Mai",
            summary: "orderConfirmed|SO-1|300000 VND",
            evidence: "2 tea boxes",
        })
    })

    it("confirms an order without customer or goods and reads the amount from the fields", async () => {
        const { service, orders, leads, evidence } = await build()
        orders.confirm.mockResolvedValue(orderOf({ lead_id: null }))

        const performed = await service.perform(ctx, itemOf(), proposalOf({ amount_vnd: 120000 }), { name: "Mai" })

        expect(performed.href).toBe("/chat")
        expect(orders.confirm.mock.calls[0]?.[0].amountVnd).toBe(120000)
        expect(leads.markWon).not.toHaveBeenCalled()
        expect(evidence.log.mock.calls[0]?.[1].evidence).toBeNull()
    })

    it("answers the confirmed order again on a repeat", async () => {
        const { service, orders, evidence } = await build()
        orders.confirm.mockResolvedValue(null)
        orders.find.mockResolvedValue(orderOf({ status: "confirmed", amount_vnd: 310000 }))

        await expect(service.perform(ctx, itemOf(), proposalOf({}), { name: "Mai" })).resolves.toEqual({
            summary: "orderConfirmed|SO-1|310000 VND",
            evidence: "captured",
            href: "/leads/lead-1",
            lead_id: "lead-1",
        })
        expect(evidence.log).not.toHaveBeenCalled()
    })

    it("refuses an order that is gone or cancelled", async () => {
        const { service, orders } = await build()
        orders.confirm.mockResolvedValue(null)
        orders.find.mockResolvedValueOnce(null).mockResolvedValueOnce(orderOf({ status: "cancelled" }))

        await expect(service.perform(ctx, itemOf(), proposalOf({}), { name: "Mai" })).rejects.toMatchObject({
            code: WorkPerformersErrorCode.OrderUnavailable,
        })
        await expect(service.perform(ctx, itemOf(), proposalOf({}), { name: "Mai" })).rejects.toMatchObject({
            code: WorkPerformersErrorCode.OrderUnavailable,
        })
    })
})

describe("ConfirmOrderPerformerService perform", () => {
    it("refuses an item that names no order", async () => {
        const { service } = await build()

        await expect(
            service.perform(ctx, itemOf({ subject_id: null }), proposalOf({}), { name: "Mai" }),
        ).rejects.toMatchObject({ code: WorkPerformersErrorCode.SubjectMissing })
    })

    it("publishes the confirmed order and won deal with the stored customer details", async () => {
        const { service, orders, leads, automationEvents } = await build()
        orders.confirm.mockResolvedValue(orderOf({ status: "confirmed" }))
        leads.find.mockResolvedValue(leadOf())

        await expect(
            service.perform(ctx, itemOf(), proposalOf({ customer: "Proposal name", items: "2 tea boxes" }, 300000), {
                name: "Mai",
            }),
        ).resolves.toEqual({
            summary: "orderConfirmed|SO-1|300000 VND",
            evidence: "captured",
            href: "/leads/lead-1",
            lead_id: "lead-1",
        })
        expect(leads.find).toHaveBeenCalledWith("ws-1", "lead-1")
        expect(automationEvents.publish.mock.calls).toEqual([
            [
                "ws-1",
                "order.confirmed",
                {
                    order_id: "ord-1",
                    order_no: "SO-1",
                    lead_id: "lead-1",
                    customer: "Lan",
                    items: "2 tea boxes",
                    amount_vnd: 300000,
                    channel: "Telegram",
                    confirmed_by: "Mai",
                    status: "confirmed",
                },
                "order.confirmed:ord-1",
            ],
            [
                "ws-1",
                "deal.won",
                {
                    lead_id: "lead-1",
                    name: "Lan",
                    company: "Hue Tea",
                    channel: "Telegram",
                    need: "tea",
                    order_no: "SO-1",
                    amount_vnd: 300000,
                },
                "deal.won:lead-1",
            ],
        ])
    })
})

describe("ConfirmOrderPerformerService onReject", () => {
    it("cancels the draft and leaves the evidence line", async () => {
        const { service, orders, evidence } = await build()
        orders.cancel.mockResolvedValue(orderOf({ status: "cancelled" }))

        await expect(service.onReject(ctx, itemOf())).resolves.toBeUndefined()
        expect(orders.cancel).toHaveBeenCalledWith("ws-1", "ord-1")
        expect(evidence.log).toHaveBeenCalledWith(ctx, {
            lead_id: "lead-1",
            work_item_id: "item-1",
            kind: "order.cancelled",
            actor: "Lan",
            summary: "orderCancelled|SO-1",
        })
    })

    it("cancels nothing for an item that is not an order or an order already gone", async () => {
        const { service, orders, evidence } = await build()
        orders.cancel.mockResolvedValue(null)

        await service.onReject(ctx, itemOf({ subject_type: "lead" }))
        await service.onReject(ctx, itemOf({ subject_id: null }))
        await service.onReject(ctx, itemOf())

        expect(orders.cancel).toHaveBeenCalledTimes(1)
        expect(evidence.log).not.toHaveBeenCalled()
    })
})
