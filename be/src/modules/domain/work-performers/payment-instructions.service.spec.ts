import { builder, mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { AgentConversationsService } from "@modules/domain/agent-conversations"
import { AgentsService } from "@modules/domain/agents"
import type { AgentProfile } from "@modules/domain/agents"
import { EvidenceService, formatVnd } from "@modules/domain/decisions"
import type { WorkContext, WorkItem } from "@modules/domain/decisions"
import type { InvoiceRow } from "@modules/domain/invoices"
import { LeadRecordsService } from "@modules/domain/leads"
import type { LeadRecordRow } from "@modules/domain/leads"
import { OrdersService } from "@modules/domain/orders"
import { CustomerDeliveryService } from "./customer-delivery.service"
import { PaymentInstructionsService } from "./payment-instructions.service"
import { PerformerKitService } from "./performer-kit.service"

const ctx: WorkContext = { workspaceId: "ws-1", actor: "Lan", locale: "en" }

const item: WorkItem = {
    id: "item-1",
    workspace_id: "ws-1",
    department: "accounting",
    action: "issue_invoice",
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
    proposal: { summary: "Invoice", fields: {} },
    result: null,
    error: null,
    evidence_state: "pending",
    assigned_staff_id: null,
    execution_id: null,
    origin: "live",
    created_at: "2026-10-12T09:00:00.000Z",
    updated_at: "2026-10-12T09:00:00.000Z",
    completed_at: null,
    installation_id: null,
}

const invoiceOf = builder<InvoiceRow>({
    id: "inv-1",
    workspace_id: "ws-1",
    order_id: "ord-1",
    lead_id: "lead-1",
    invoice_no: "INV-1",
    amount_vnd: 450000,
    status: "issued",
    origin: "live",
    issued_by: "Lan",
    paid_at: null,
})

const lead: LeadRecordRow = {
    id: "lead-1",
    workspace_id: "ws-1",
    contact_name: "Lan",
    company: "Hue Tea",
    channel: "telegram",
    need: "wholesale",
    stage: "won",
    context_summary: null,
    phone: null,
    email: null,
    origin: "live",
}

const profileOf = (knowledge: string): AgentProfile => ({
    id: "agent-1",
    name: "Mai",
    handle: "mai",
    role: "chatbot",
    instructions: "Be brief",
    knowledge,
    approval_rule: "",
})

const conversation = { id: "conv-1", agentId: "agent-1", channel: "telegram", visitorName: "Khach" }

describe("PaymentInstructionsService", () => {
    const build = async () => {
        const kit = mock<PerformerKitService>()
        kit.text.mockImplementation((_ctx, key, params = {}) => [key, ...Object.values(params).map(String)].join("|"))
        kit.department.mockResolvedValue("Accounting")
        const conversations = mock<AgentConversationsService>()
        conversations.latestOfLead.mockResolvedValue(conversation)
        const agents = mock<AgentsService>()
        const leads = mock<LeadRecordsService>()
        const orders = mock<OrdersService>()
        const delivery = mock<CustomerDeliveryService>()
        const evidence = mock<EvidenceService>()
        const moduleRef = await Test.createTestingModule({
            providers: [
                PaymentInstructionsService,
                { provide: PerformerKitService, useValue: kit },
                { provide: AgentConversationsService, useValue: conversations },
                { provide: AgentsService, useValue: agents },
                { provide: LeadRecordsService, useValue: leads },
                { provide: OrdersService, useValue: orders },
                { provide: CustomerDeliveryService, useValue: delivery },
                { provide: EvidenceService, useValue: evidence },
            ],
        }).compile()
        return {
            service: moduleRef.get(PaymentInstructionsService),
            conversations,
            agents,
            leads,
            orders,
            delivery,
            evidence,
        }
    }

    it("sends the goods, the amount, the code and the bank details of the agent's notes", async () => {
        const { service, conversations, agents, leads, orders, delivery, evidence } = await build()
        leads.find.mockResolvedValue(lead)
        orders.labelsOf.mockResolvedValue([{ id: "ord-1", order_no: "SO-1", items: "2 tea boxes" }])
        agents.profileOf.mockResolvedValue(profileOf("Hours: 8-17\nBank transfer details: VCB 0123 Hue Tea"))
        delivery.inConversation.mockResolvedValue(true)
        const text = `payInstructions|2 tea boxes|${formatVnd(450000, "en")}|INV-1|payTransferLine|VCB 0123 Hue Tea`

        await expect(service.send(ctx, item, invoiceOf())).resolves.toBe("payInstructionsSent|INV-1|Lan")

        expect(conversations.latestOfLead).toHaveBeenCalledWith("ws-1", "lead-1", "telegram")
        expect(agents.profileOf).toHaveBeenCalledWith("ws-1", "agent-1")
        expect(delivery.inConversation).toHaveBeenCalledWith("ws-1", "conv-1", text)
        expect(evidence.log).toHaveBeenCalledWith(ctx, {
            lead_id: "lead-1",
            work_item_id: "item-1",
            kind: "invoice.instructions_sent",
            actor: "Accounting",
            summary: "payInstructionsSent|INV-1|Lan",
            evidence: text,
        })
    })

    it("says the team will send the bank details and records a failed delivery", async () => {
        const { service, agents, leads, orders, delivery, evidence } = await build()
        leads.find.mockResolvedValue(null)
        agents.profileOf.mockResolvedValue(null)
        agents.profileOfDepartment.mockResolvedValue(profileOf(""))
        delivery.inConversation.mockResolvedValue(false)
        const text = `payInstructions|—|${formatVnd(450000, "en")}|INV-1|payTransferLater`

        await expect(service.send(ctx, item, invoiceOf({ order_id: null }))).resolves.toBe(
            "payInstructionsFailed|INV-1|Khach",
        )

        expect(orders.labelsOf).not.toHaveBeenCalled()
        expect(agents.profileOfDepartment).toHaveBeenCalledWith("ws-1", "chatbot")
        expect(delivery.inConversation).toHaveBeenCalledWith("ws-1", "conv-1", text)
        expect(evidence.log.mock.calls[0]?.[1].kind).toBe("invoice.instructions_failed")
    })

    it("names the order as a dash when it lists no goods and the customer as a dash when nobody is named", async () => {
        const { service, conversations, agents, leads, orders, delivery } = await build()
        conversations.latestOfLead.mockResolvedValue({ ...conversation, visitorName: null })
        leads.find.mockResolvedValue(null)
        orders.labelsOf.mockResolvedValue([{ id: "ord-1", order_no: "SO-1", items: "" }])
        agents.profileOf.mockResolvedValue(null)
        agents.profileOfDepartment.mockResolvedValue(null)
        delivery.inConversation.mockResolvedValue(true)

        await expect(service.send(ctx, item, invoiceOf())).resolves.toBe("payInstructionsSent|INV-1|—")

        expect(delivery.inConversation.mock.calls[0]?.[2]).toBe(
            `payInstructions|—|${formatVnd(450000, "en")}|INV-1|payTransferLater`,
        )
    })

    it("sends nothing for an invoice without a customer", async () => {
        const { service, conversations } = await build()

        await expect(service.send(ctx, item, invoiceOf({ lead_id: null }))).resolves.toBeNull()

        expect(conversations.latestOfLead).not.toHaveBeenCalled()
    })

    it("sends nothing when the customer has no Telegram conversation", async () => {
        const { service, conversations, delivery } = await build()
        conversations.latestOfLead.mockResolvedValue(null)

        await expect(service.send(ctx, item, invoiceOf())).resolves.toBeNull()

        expect(delivery.inConversation).not.toHaveBeenCalled()
    })
})
