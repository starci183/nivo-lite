import { fakeTransaction, mock, mockEntityManager, recordingEventBus } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { WorkEngineService } from "@modules/domain/decisions"
import type { WorkContext, WorkItem } from "@modules/domain/decisions"
import { EventsService } from "@modules/domain/events"
import { InboundEventsService } from "@modules/domain/inbound-events"
import { LeadRecordsService } from "@modules/domain/leads"
import type { LeadRecordRow } from "@modules/domain/leads"
import { ResponsibilityJournalService } from "@modules/domain/responsibilities"
import { WorkItemsService } from "@modules/domain/work-items"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { EVENT_BUS } from "@modules/platform/event-bus"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { LeadActionsErrorCode } from "./errors/lead-actions.error"
import { LeadActionFlowService } from "./lead-action-flow.service"
import type { LeadActionInput, LeadActionRun } from "./lead-actions.contracts"

const ctx: WorkContext = { workspaceId: "ws-1", actor: "Lan", locale: "vi" }

const lead: LeadRecordRow = {
    id: "lead-1",
    workspace_id: "ws-1",
    contact_name: "Lan",
    company: "Hue Tea",
    channel: "zalo",
    need: "tea",
    stage: "new",
    context_summary: null,
    phone: null,
    email: null,
}

const run: LeadActionRun = {
    id: "run-1",
    workspaceId: "ws-1",
    requestedBy: "user-1",
    action: "settle-won",
    input: { leadId: "lead-1" },
    locale: "vi",
    status: "running",
    result: null,
    errorCode: null,
}

const work: WorkItem = {
    id: "work-1",
    workspace_id: "ws-1",
    department: "sales",
    action: "send_follow_up",
    subject_type: "lead",
    subject_id: "lead-1",
    lead_id: "lead-1",
    inbound_event_id: "inbound-1",
    parent_id: null,
    chain_id: null,
    depth: 0,
    status: "done",
    decided_path: "auto",
    reason: null,
    reasons: [],
    missing_fields: [],
    proposal: { summary: "Follow up", fields: {} },
    result: null,
    error: null,
    evidence_state: "captured",
    assigned_staff_id: null,
    execution_id: "execution-1",
    created_at: "2026-10-14T00:00:00.000Z",
    updated_at: "2026-10-14T00:00:00.000Z",
    completed_at: "2026-10-14T00:00:00.000Z",
    installation_id: null,
}

const responsibility = {
    id: "resp-1",
    workspace_id: "ws-1",
    lead_id: "lead-1",
    title: "Call back",
    owner_kind: "human" as const,
    owner_agent_id: null,
    owner_member_id: "member-1",
    owner_name: "Lan",
    next_action: "Call",
    due_at: null,
    status: "open" as const,
    created_at: "2026-10-14T00:00:00.000Z",
}

const leads = mock<LeadRecordsService>()

const inbound = mock<InboundEventsService>()

const events = mock<EventsService>()

const eventBus = recordingEventBus()

const catalog = mock<MessageCatalog>()

const engine = mock<WorkEngineService>()

const items = mock<WorkItemsService>()

const responsibilities = mock<ResponsibilityJournalService>()

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            LeadActionFlowService,
            { provide: LeadRecordsService, useValue: leads },
            { provide: InboundEventsService, useValue: inbound },
            { provide: EventsService, useValue: events },
            { provide: EVENT_BUS, useValue: eventBus },
            { provide: PRIMARY_ENTITY_MANAGER, useValue: fakeTransaction(mockEntityManager()).em },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: WorkEngineService, useValue: engine },
            { provide: WorkItemsService, useValue: items },
            { provide: ResponsibilityJournalService, useValue: responsibilities },
        ],
    }).compile()
    return moduleRef.get(LeadActionFlowService)
}

beforeEach(() => {
    jest.resetAllMocks()
    eventBus.clear()
    leads.require.mockResolvedValue(lead)
    inbound.recordInput.mockResolvedValue({ duplicate: false, inboundEventId: "inbound-1" })
    inbound.find.mockResolvedValue(null)
    leads.match.mockResolvedValue(null)
    leads.capture.mockResolvedValue(lead)
    catalog.get.mockImplementation((key, params) => `${key}:${JSON.stringify(params)}`)
    responsibilities.ensureFor.mockResolvedValue(responsibility)
    engine.runWork.mockResolvedValue(work)
    items.findByDedupe.mockResolvedValue(null)
    responsibilities.find.mockResolvedValue(responsibility)
})

describe("LeadActionFlowService", () => {
    it("refuses to settle a lead that is not won", async () => {
        const service = await build()

        await expect(service.settleWon(ctx, run)).rejects.toMatchObject({ code: LeadActionsErrorCode.NotWon })
    })
})

describe("LeadActionFlowService", () => {
    it("creates a core customer without installed agent modules and assigns the workspace owner's follow-up", async () => {
        const service = await build()
        engine.runWork.mockRejectedValue(new Error("No agent module is installed"))
        const input: LeadActionInput = {
            contactName: "Lan",
            company: "Hue Tea",
            channel: "zalo",
            need: "tea",
            phone: " 0912 000 701 ",
            email: " LAN@EXAMPLE.COM ",
        }

        await expect(service.create(ctx, { ...run, action: "create", input })).resolves.toEqual({
            leadId: "lead-1",
            responsibilityId: "resp-1",
        })
        expect(inbound.recordInput).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            channel: "manual",
            kind: "lead",
            senderName: "Lan",
            senderContact: "0912 000 701",
            body: "tea",
            externalRef: "zalo:Hue Tea",
            eventId: "run-1",
        })
        expect(leads.match).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            phone: "84912000701",
            email: "lan@example.com",
            name: "Lan",
            channel: "zalo",
        })
        expect(leads.capture).toHaveBeenCalledWith(
            {
                workspaceId: "ws-1",
                contactName: "Lan",
                company: "Hue Tea",
                channel: "zalo",
                need: "tea",
                phone: "84912000701",
                email: "lan@example.com",
            },
            expect.anything(),
        )
        expect(events.record).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            leadId: "lead-1",
            kind: "lead.captured",
            actor: "Lan",
            summary: 'lead-actions.captured:{"channel":"zalo"}',
        })
        expect(catalog.get).toHaveBeenCalledWith("lead-actions.captured", { channel: "zalo" }, "vi")
        expect(eventBus.writes[0]).toMatchObject({
            eventName: "lead_captured",
            payload: { dedupeKey: "lead.created:lead-1", workspaceId: "ws-1", leadId: "lead-1" },
        })
        expect(inbound.mark).toHaveBeenCalledWith("ws-1", "inbound-1", "processed", "lead-1")
        expect(responsibilities.ensureFor).toHaveBeenCalledWith(ctx, "lead-1")
        expect(leads.fillContact).not.toHaveBeenCalled()
        expect(engine.runWork).not.toHaveBeenCalled()
    })
})

describe("LeadActionFlowService", () => {
    it("reuses the inbound event's linked customer on a retry after the customer's contact details changed", async () => {
        const service = await build()
        inbound.recordInput.mockResolvedValue({ duplicate: true, inboundEventId: "inbound-1" })
        inbound.find.mockResolvedValue({
            id: "inbound-1",
            workspace_id: "ws-1",
            channel: "manual",
            kind: "lead",
            sender_name: "Lan",
            sender_contact: null,
            body: "tea",
            amount_vnd: null,
            external_ref: "zalo:Hue Tea",
            event_id: "run-1",
            lead_id: "lead-1",
            status: "processed",
        })
        leads.require.mockResolvedValue({ ...lead, contact_name: "Lan Nguyen", channel: "phone" })

        await expect(service.create(ctx, { ...run, input: { contactName: "Lan", channel: "zalo" } })).resolves.toEqual({
            leadId: "lead-1",
            responsibilityId: "resp-1",
        })
        expect(inbound.find).toHaveBeenCalledWith("ws-1", "inbound-1")
        expect(leads.require).toHaveBeenCalledWith("ws-1", "lead-1")
        expect(leads.match).not.toHaveBeenCalled()
        expect(leads.capture).not.toHaveBeenCalled()
        expect(events.record).not.toHaveBeenCalled()
        expect(eventBus.writes).toEqual([])
    })
})

describe("LeadActionFlowService", () => {
    it.each([
        { input: {}, senderContact: null },
        { input: { phone: " ", email: " LAN@EXAMPLE.COM " }, senderContact: "LAN@EXAMPLE.COM" },
        { input: { email: " " }, senderContact: null },
    ])("records an email or no contact when phone is absent: $senderContact", async ({ input, senderContact }) => {
        const service = await build()

        await expect(service.create(ctx, { ...run, action: "create", input })).resolves.toEqual({
            leadId: "lead-1",
            responsibilityId: "resp-1",
        })
        expect(inbound.recordInput).toHaveBeenCalledWith(
            expect.objectContaining({
                senderName: "",
                senderContact,
                body: "",
                externalRef: ":",
            }),
        )
        expect(leads.capture).toHaveBeenCalledWith(
            expect.objectContaining({
                contactName: "",
                company: "",
                channel: "",
                need: "",
                phone: null,
            }),
            expect.anything(),
        )
    })

    it("reuses a known customer and fills their missing contacts instead of recording a second capture", async () => {
        const service = await build()
        leads.match.mockResolvedValue(lead)

        await expect(service.create(ctx, { ...run, input: { phone: "0912 000 701" } })).resolves.toEqual({
            leadId: "lead-1",
            responsibilityId: "resp-1",
        })
        expect(leads.fillContact).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            leadId: "lead-1",
            phone: "84912000701",
            email: null,
        })
        expect(leads.capture).not.toHaveBeenCalled()
        expect(events.record).not.toHaveBeenCalled()
        expect(eventBus.writes).toEqual([])
        expect(inbound.mark).toHaveBeenCalledWith("ws-1", "inbound-1", "processed", "lead-1")
        expect(responsibilities.ensureFor).toHaveBeenCalledWith(ctx, "lead-1")
    })

    it("drafts the next step and returns the latest approval execution", async () => {
        const service = await build()
        leads.require.mockResolvedValue(lead)
        items.findByDedupe.mockResolvedValue({ ...work, execution_id: "latest-execution" })

        await expect(service.draft(ctx, { ...run, input: { responsibilityId: "resp-1" } })).resolves.toEqual({
            leadId: "lead-1",
            responsibilityId: "resp-1",
            workItemId: "work-1",
            executionId: "latest-execution",
        })
        expect(responsibilities.find).toHaveBeenCalledWith("ws-1", "resp-1")
        expect(leads.require).toHaveBeenCalledWith("ws-1", "lead-1")
        expect(engine.runWork).toHaveBeenCalledWith(ctx, {
            action: "send_follow_up",
            subject_type: "lead",
            subject_id: "lead-1",
            lead_id: "lead-1",
            dedupeKey: "send_follow_up:resp:resp-1:run-1",
            noChain: true,
            seed: { fields: { responsibility_id: "resp-1" } },
        })
        expect(items.findByDedupe).toHaveBeenCalledWith("ws-1", "send_follow_up:resp:resp-1:run-1")
    })
})

describe("LeadActionFlowService", () => {
    it.each([null, { ...work, execution_id: null }])(
        "uses the drafted execution when the current execution is absent: %p",
        async (current) => {
            const service = await build()
            items.findByDedupe.mockResolvedValue(current)

            await expect(service.draft(ctx, { ...run, input: {} })).resolves.toEqual({
                leadId: "lead-1",
                responsibilityId: "resp-1",
                workItemId: "work-1",
                executionId: "execution-1",
            })
            expect(responsibilities.find).toHaveBeenCalledWith("ws-1", "")
        },
    )

    it("refuses a missing responsibility before drafting work", async () => {
        const service = await build()
        responsibilities.find.mockResolvedValue(null)

        await expect(service.draft(ctx, run)).rejects.toMatchObject({ code: LeadActionsErrorCode.NotFound })
        expect(leads.require).not.toHaveBeenCalled()
        expect(engine.runWork).not.toHaveBeenCalled()
    })

    it("processes queued work and falls back to stored work when another worker claimed it", async () => {
        const service = await build()
        engine.runWork.mockResolvedValue({ ...work, status: "queued" })
        engine.runQueuedItem.mockResolvedValue(null)
        items.findByDedupe.mockResolvedValue({ ...work, id: "stored-work", status: "waiting_decision" })

        await expect(service.draft(ctx, { ...run, input: {} })).resolves.toEqual({
            leadId: "lead-1",
            responsibilityId: "resp-1",
            workItemId: "stored-work",
            executionId: "execution-1",
        })
        expect(engine.runQueuedItem).toHaveBeenCalledWith(ctx, "work-1")
        expect(items.findByDedupe).toHaveBeenCalledWith("ws-1", "send_follow_up:resp:resp-1:run-1")
    })

    it("reports busy when queued work remains queued", async () => {
        const service = await build()
        engine.runWork.mockResolvedValue({ ...work, status: "queued" })
        engine.runQueuedItem.mockResolvedValue({ ...work, status: "queued" })

        await expect(service.draft(ctx, run)).rejects.toMatchObject({ code: LeadActionsErrorCode.Busy })
    })
})

describe("LeadActionFlowService", () => {
    it("reports the original work id when queued work disappears", async () => {
        const service = await build()
        engine.runWork.mockResolvedValue({ ...work, status: "queued" })
        engine.runQueuedItem.mockResolvedValue(null)

        await expect(service.draft(ctx, run)).rejects.toMatchObject({
            code: LeadActionsErrorCode.WorkFailed,
            params: { workItemId: "work-1" },
        })
        expect(items.findByDedupe).toHaveBeenCalledWith("ws-1", "send_follow_up:resp:resp-1:run-1")
    })

    it.each(["failed", "rejected"] as const)("refuses %s work", async (status) => {
        const service = await build()
        engine.runWork.mockResolvedValue({ ...work, status })

        await expect(service.draft(ctx, run)).rejects.toMatchObject({
            code: LeadActionsErrorCode.WorkFailed,
            params: { workItemId: "work-1" },
        })
        expect(engine.runQueuedItem).not.toHaveBeenCalled()
    })
})

describe("LeadActionFlowService", () => {
    it.each([
        { evidence: "Signed agreement", expected: "Signed agreement" },
        { evidence: "", expected: null },
    ])("prepares an invoice and emits the won event with evidence $expected", async ({ evidence, expected }) => {
        const service = await build()
        leads.require.mockResolvedValue({ ...lead, stage: "won" })

        await expect(service.settleWon(ctx, { ...run, input: { evidence } })).resolves.toEqual({
            leadId: "lead-1",
            workItemId: "work-1",
        })
        expect(leads.require).toHaveBeenCalledWith("ws-1", "")
        expect(engine.runWork).toHaveBeenCalledWith(ctx, {
            action: "issue_invoice",
            subject_type: "lead",
            subject_id: "lead-1",
            lead_id: "lead-1",
            dedupeKey: "issue_invoice:lead:lead-1",
            seed: { amount_vnd: null, fields: {} },
        })
        expect(eventBus.writes[0]).toMatchObject({
            eventName: "deal_won",
            payload: {
                dedupeKey: "deal.won:lead-1",
                workspaceId: "ws-1",
                leadId: "lead-1",
                name: "Lan",
                company: "Hue Tea",
                channel: "zalo",
                need: "tea",
                evidence: expected,
            },
        })
    })
})
