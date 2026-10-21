import { builder, mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import type { Performed, WorkContext, WorkItem } from "@modules/domain/decisions"
import { LeadRecordsService } from "@modules/domain/leads"
import type { LeadRecordRow } from "@modules/domain/leads"
import { CustomerDeliveryService } from "./customer-delivery.service"
import { WorkPerformersErrorCode } from "./errors/work-performers.error"
import { PerformerKitService } from "./performer-kit.service"
import { QuotePerformerService } from "./quote-performer.service"

const ctx: WorkContext = { workspaceId: "ws-1", actor: "Lan", locale: "en" }

const itemOf = builder<WorkItem>({
    id: "item-1",
    workspace_id: "ws-1",
    department: "sales",
    action: "send_quote",
    subject_type: "lead",
    subject_id: "lead-1",
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
    proposal: { summary: "Quote", draft: "50 boxes at 1.5M", amount_vnd: 1500000, fields: { items: "50 boxes" } },
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

const lead: LeadRecordRow = {
    id: "lead-1",
    workspace_id: "ws-1",
    contact_name: "Lan",
    company: "Hue Tea",
    channel: "zalo",
    need: "wholesale",
    stage: "proposal",
    context_summary: null,
    phone: null,
    email: "lan@huetea.vn",
}

const performed: Performed = {
    summary: "Delivered to Lan",
    evidence: "captured",
    href: "/leads/lead-1",
    lead_id: "lead-1",
    detail: "50 boxes at 1.5M",
}

const build = async () => {
    const kit = mock<PerformerKitService>()
    kit.text.mockImplementation((_ctx, key, params = {}) => [key, ...Object.values(params).map(String)].join("|"))
    kit.money.mockImplementation((_ctx, amount) =>
        amount === null || amount === undefined ? "no amount" : `${amount} VND`,
    )
    const leads = mock<LeadRecordsService>()
    leads.require.mockResolvedValue(lead)
    const delivery = mock<CustomerDeliveryService>()
    delivery.contactOf.mockResolvedValue("lan@huetea.vn")
    const moduleRef = await Test.createTestingModule({
        providers: [
            QuotePerformerService,
            { provide: PerformerKitService, useValue: kit },
            { provide: LeadRecordsService, useValue: leads },
            { provide: CustomerDeliveryService, useValue: delivery },
        ],
    }).compile()
    return { service: moduleRef.get(QuotePerformerService), leads, delivery }
}

describe("QuotePerformerService prepare", () => {
    it("keeps the approved amount and adds the customer and the contact", async () => {
        const { service, leads } = await build()

        await expect(service.prepare(ctx, itemOf())).resolves.toEqual({
            proposal: {
                summary: "quoteSummary|Lan|1500000 VND",
                draft: "50 boxes at 1.5M",
                amount_vnd: 1500000,
                fields: { items: "50 boxes", customer: "Lan", contact: "lan@huetea.vn", amount_vnd: 1500000 },
            },
        })
        expect(leads.require).toHaveBeenCalledWith("ws-1", "lead-1")
    })

    it("says there is no amount when the proposal carries none", async () => {
        const { service } = await build()
        const item = itemOf({ proposal: { summary: "Quote", fields: {} } })

        await expect(service.prepare(ctx, item)).resolves.toEqual({
            proposal: {
                summary: "quoteSummary|Lan|no amount",
                amount_vnd: null,
                fields: { customer: "Lan", contact: "lan@huetea.vn", amount_vnd: null },
            },
        })
    })

    it("refuses an item without a customer", async () => {
        const { service } = await build()

        await expect(service.prepare(ctx, itemOf({ lead_id: null }))).rejects.toMatchObject({
            code: WorkPerformersErrorCode.SubjectMissing,
        })
    })
})

describe("QuotePerformerService perform", () => {
    it("delivers the approved draft and leaves the quote evidence", async () => {
        const { service, delivery } = await build()
        delivery.sendAndLog.mockResolvedValue(performed)
        const item = itemOf()

        await expect(service.perform(ctx, item, item.proposal, { name: "Mai", kind: "owner" })).resolves.toEqual(
            performed,
        )
        expect(delivery.sendAndLog).toHaveBeenCalledWith(
            ctx,
            item,
            lead,
            "50 boxes at 1.5M",
            { name: "Mai", kind: "owner" },
            "quote.sent",
        )
    })

    it("delivers the summary when there is no draft", async () => {
        const { service, delivery } = await build()
        delivery.sendAndLog.mockResolvedValue(performed)

        await service.perform(ctx, itemOf(), { summary: "Quote of 1.5M", fields: {} }, { name: "Mai" })

        expect(delivery.sendAndLog.mock.calls[0]?.[3]).toBe("Quote of 1.5M")
    })

    it("refuses an item without a customer", async () => {
        const { service } = await build()

        await expect(
            service.perform(ctx, itemOf({ lead_id: null }), { summary: "s", fields: {} }, { name: "Mai" }),
        ).rejects.toMatchObject({ code: WorkPerformersErrorCode.SubjectMissing })
    })
})
