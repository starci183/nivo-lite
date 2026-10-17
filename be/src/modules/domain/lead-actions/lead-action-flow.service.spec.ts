import { mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { AutomationsService } from "@modules/domain/automations"
import { CommandBusService, WorkEngineService } from "@modules/domain/decisions"
import type { WorkContext, WorkItem } from "@modules/domain/decisions"
import { InboundEventsService } from "@modules/domain/inbound-events"
import { LeadRecordsService } from "@modules/domain/leads"
import type { LeadRecordRow } from "@modules/domain/leads"
import { ResponsibilityJournalService } from "@modules/domain/responsibilities"
import { WorkItemsService } from "@modules/domain/work-items"
import { LeadActionsErrorCode } from "./errors/lead-actions.error"
import { LeadActionFlowService } from "./lead-action-flow.service"
import type { LeadActionInput } from "./lead-actions.contracts"
import type { LeadActionRunRow } from "./persistence/lead-actions.rows"

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
    origin: "live",
}

const run: LeadActionRunRow = {
    id: "run-1",
    workspace_id: "ws-1",
    requested_by: "user-1",
    action: "settle-won",
    input: { leadId: "lead-1" },
    locale: "vi",
    status: "running",
    result: null,
    error_code: null,
}

const work: WorkItem = {
    id: "work-1",
    workspace_id: "ws-1",
    department: "chatbot",
    action: "capture_lead",
    subject_type: "inbound",
    subject_id: "inbound-1",
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
    proposal: { summary: "Captured", fields: {} },
    result: null,
    error: null,
    evidence_state: "captured",
    assigned_staff_id: null,
    execution_id: "execution-1",
    origin: "live",
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
    owner_name: "Lan",
    next_action: "Call",
    due_at: null,
    status: "open" as const,
    created_at: "2026-10-14T00:00:00.000Z",
}

const leads = mock<LeadRecordsService>()

const inbound = mock<InboundEventsService>()

const commands = mock<CommandBusService>()

const engine = mock<WorkEngineService>()

const items = mock<WorkItemsService>()

const responsibilities = mock<ResponsibilityJournalService>()

const automations = mock<AutomationsService>()

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            LeadActionFlowService,
            { provide: LeadRecordsService, useValue: leads },
            { provide: InboundEventsService, useValue: inbound },
            { provide: CommandBusService, useValue: commands },
            { provide: WorkEngineService, useValue: engine },
            { provide: WorkItemsService, useValue: items },
            { provide: ResponsibilityJournalService, useValue: responsibilities },
            { provide: AutomationsService, useValue: automations },
        ],
    }).compile()
    return moduleRef.get(LeadActionFlowService)
}

beforeEach(() => {
    jest.resetAllMocks()
    leads.require.mockResolvedValue(lead)
    inbound.recordInput.mockResolvedValue({ duplicate: false, inboundEventId: "inbound-1" })
    inbound.find.mockResolvedValue(null)
    commands.sendCommandItem.mockResolvedValue(work)
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
    it("records manual capture details, normalises both contacts and continues the owner chain", async () => {
        const service = await build()
        const input: LeadActionInput = {
            contactName: "Lan",
            company: "Hue Tea",
            channel: "zalo",
            need: "tea",
            phone: " 0912 000 701 ",
            email: " LAN@EXAMPLE.COM ",
        }
        items.findByDedupe
            .mockResolvedValueOnce({ ...work, id: "classified-1" })
            .mockResolvedValueOnce({ ...work, id: "follow-1", status: "queued" })
        engine.runQueuedItem.mockResolvedValue({ ...work, id: "follow-1" })

        await expect(service.create(ctx, { ...run, action: "create", input })).resolves.toEqual({
            leadId: "lead-1",
            workItemId: "work-1",
        })
        expect(inbound.recordInput).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            channel: "manual",
            kind: "lead",
            origin: "live",
            senderName: "Lan",
            senderContact: "0912 000 701",
            body: "tea",
            externalRef: "zalo:Hue Tea",
            eventId: "run-1",
        })
        expect(commands.sendCommandItem).toHaveBeenCalledWith(ctx, {
            from: "owner",
            to: "chatbot",
            command: "handoff_lead",
            reason: "manual lead",
            inboundEventId: "inbound-1",
            origin: "live",
            dedupeKey: "handoff_lead:inbound:inbound-1",
            payload: {
                subject_type: "inbound",
                subject_id: "inbound-1",
                contact_name: "Lan",
                company: "Hue Tea",
                need: "tea",
                contact: "0912 000 701",
                phone: " 0912 000 701 ",
                email: " LAN@EXAMPLE.COM ",
                channel_label: "zalo",
            },
        })
        expect(leads.fillContact).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            leadId: "lead-1",
            phone: "84912000701",
            email: "lan@example.com",
        })
        expect(inbound.find).not.toHaveBeenCalled()
        expect(items.findByDedupe.mock.calls).toEqual([
            ["ws-1", "classify_lead:after:work-1"],
            ["ws-1", "send_follow_up:after:classified-1"],
        ])
        expect(engine.runQueuedItem).toHaveBeenCalledWith(ctx, "follow-1")
    })
})

describe("LeadActionFlowService", () => {
    it("defaults omitted capture fields and returns no lead when the event is absent", async () => {
        const service = await build()
        commands.sendCommandItem.mockResolvedValue({ ...work, lead_id: null, status: "waiting_decision" })

        await expect(service.create(ctx, { ...run, input: {} })).resolves.toEqual({
            leadId: null,
            workItemId: "work-1",
        })
        expect(inbound.recordInput).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            channel: "manual",
            kind: "lead",
            origin: "live",
            senderName: "",
            senderContact: null,
            body: "",
            externalRef: ":",
            eventId: "run-1",
        })
        expect(commands.sendCommandItem).toHaveBeenCalledWith(
            ctx,
            expect.objectContaining({
                payload: {
                    subject_type: "inbound",
                    subject_id: "inbound-1",
                    contact_name: "",
                    company: "",
                    need: "",
                    contact: null,
                    phone: null,
                    email: null,
                    channel_label: "",
                },
            }),
        )
        expect(inbound.find).toHaveBeenCalledWith("ws-1", "inbound-1")
        expect(leads.fillContact).not.toHaveBeenCalled()
        expect(items.findByDedupe).not.toHaveBeenCalled()
    })
})

describe("LeadActionFlowService", () => {
    it("uses the email when the phone is blank and recovers the lead linked to the inbound event", async () => {
        const service = await build()
        commands.sendCommandItem.mockResolvedValue({ ...work, lead_id: null })
        inbound.find.mockResolvedValue({
            id: "inbound-1",
            workspace_id: "ws-1",
            channel: "manual",
            kind: "lead",
            origin: "live",
            sender_name: null,
            sender_contact: null,
            body: "",
            amount_vnd: null,
            external_ref: null,
            event_id: "run-1",
            lead_id: "linked-lead",
            status: "processed",
        })

        await expect(
            service.create(ctx, { ...run, input: { phone: " ", email: " LAN@EXAMPLE.COM " } }),
        ).resolves.toEqual({
            leadId: "linked-lead",
            workItemId: "work-1",
        })
        expect(inbound.recordInput).toHaveBeenCalledWith(expect.objectContaining({ senderContact: "LAN@EXAMPLE.COM" }))
        expect(leads.fillContact).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            leadId: "linked-lead",
            phone: null,
            email: "lan@example.com",
        })
        expect(items.findByDedupe).toHaveBeenCalledWith("ws-1", "classify_lead:after:work-1")
    })

    it("stops the owner chain when classification is awaiting approval", async () => {
        const service = await build()
        items.findByDedupe.mockResolvedValue({ ...work, status: "waiting_decision" })

        await expect(service.create(ctx, { ...run, input: { email: " " } })).resolves.toEqual({
            leadId: "lead-1",
            workItemId: "work-1",
        })
        expect(inbound.recordInput).toHaveBeenCalledWith(expect.objectContaining({ senderContact: null }))
        expect(items.findByDedupe.mock.calls).toEqual([["ws-1", "classify_lead:after:work-1"]])
        expect(engine.runQueuedItem).not.toHaveBeenCalled()
    })
})

describe("LeadActionFlowService", () => {
    it("finishes after classification when no follow-up was queued", async () => {
        const service = await build()
        items.findByDedupe.mockResolvedValueOnce({ ...work, id: "classified-1" }).mockResolvedValueOnce(null)

        await expect(service.create(ctx, { ...run, input: {} })).resolves.toEqual({
            leadId: "lead-1",
            workItemId: "work-1",
        })
        expect(items.findByDedupe.mock.calls).toEqual([
            ["ws-1", "classify_lead:after:work-1"],
            ["ws-1", "send_follow_up:after:classified-1"],
        ])
        expect(engine.runQueuedItem).not.toHaveBeenCalled()
    })

    it("drafts a simulated lead and returns the latest approval execution", async () => {
        const service = await build()
        leads.require.mockResolvedValue({ ...lead, origin: "simulated" })
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
            origin: "simulated",
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
            expect(engine.runWork).toHaveBeenCalledWith(ctx, expect.objectContaining({ origin: "live" }))
        },
    )

    it("refuses a missing responsibility before drafting work", async () => {
        const service = await build()
        responsibilities.find.mockResolvedValue(null)

        await expect(service.draft(ctx, run)).rejects.toMatchObject({ code: LeadActionsErrorCode.NotFound })
        expect(leads.require).not.toHaveBeenCalled()
        expect(engine.runWork).not.toHaveBeenCalled()
    })

    it("processes queued capture and falls back to its stored work when another worker claimed it", async () => {
        const service = await build()
        commands.sendCommandItem.mockResolvedValue({ ...work, status: "queued" })
        engine.runQueuedItem.mockResolvedValue(null)
        items.findByDedupe.mockResolvedValueOnce({ ...work, id: "stored-work", status: "waiting_decision" })

        await expect(service.create(ctx, { ...run, input: {} })).resolves.toEqual({
            leadId: "lead-1",
            workItemId: "stored-work",
        })
        expect(engine.runQueuedItem).toHaveBeenCalledWith(ctx, "work-1")
        expect(items.findByDedupe).toHaveBeenCalledWith("ws-1", "handoff_lead:inbound:inbound-1")
    })

    it("reports busy when queued capture remains queued", async () => {
        const service = await build()
        commands.sendCommandItem.mockResolvedValue({ ...work, status: "queued" })
        engine.runQueuedItem.mockResolvedValue({ ...work, status: "queued" })

        await expect(service.create(ctx, run)).rejects.toMatchObject({ code: LeadActionsErrorCode.Busy })
        expect(leads.fillContact).not.toHaveBeenCalled()
    })
})

describe("LeadActionFlowService", () => {
    it("reports the original work id when queued capture disappears", async () => {
        const service = await build()
        commands.sendCommandItem.mockResolvedValue({ ...work, status: "queued" })
        engine.runQueuedItem.mockResolvedValue(null)

        await expect(service.create(ctx, run)).rejects.toMatchObject({
            code: LeadActionsErrorCode.WorkFailed,
            params: { workItemId: "work-1" },
        })
        expect(items.findByDedupe).toHaveBeenCalledWith("ws-1", "handoff_lead:inbound:inbound-1")
        expect(leads.fillContact).not.toHaveBeenCalled()
    })

    it.each(["failed", "rejected"] as const)("refuses %s capture work", async (status) => {
        const service = await build()
        commands.sendCommandItem.mockResolvedValue({ ...work, status })

        await expect(service.create(ctx, run)).rejects.toMatchObject({
            code: LeadActionsErrorCode.WorkFailed,
            params: { workItemId: "work-1" },
        })
        expect(engine.runQueuedItem).not.toHaveBeenCalled()
        expect(leads.fillContact).not.toHaveBeenCalled()
    })
})

describe("LeadActionFlowService", () => {
    it.each([
        { origin: "simulated" as const, evidence: "Signed agreement", expected: "Signed agreement" },
        { origin: "live" as const, evidence: "", expected: null },
    ])("prepares an invoice and emits the won event for $origin lead", async ({ origin, evidence, expected }) => {
        const service = await build()
        leads.require.mockResolvedValue({ ...lead, stage: "won", origin })

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
            origin,
            dedupeKey: "issue_invoice:lead:lead-1",
            seed: { amount_vnd: null, fields: {} },
        })
        expect(automations.emit).toHaveBeenCalledWith("user-1", "ws-1", {
            event: "deal.won",
            dedupe: "deal.won:lead-1",
            data: {
                lead_id: "lead-1",
                name: "Lan",
                company: "Hue Tea",
                channel: "zalo",
                need: "tea",
                evidence: expected,
            },
        })
    })
})
