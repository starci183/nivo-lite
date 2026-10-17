import { builder, mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { EvidenceService } from "@modules/domain/decisions"
import type { Proposal, WorkContext, WorkItem } from "@modules/domain/decisions"
import { EventsService } from "@modules/domain/events"
import { LeadRecordsService } from "@modules/domain/leads"
import type { LeadRecordRow } from "@modules/domain/leads"
import { ResponsibilityJournalService } from "@modules/domain/responsibilities"
import type { ResponsibilityRecord } from "@modules/domain/responsibilities"
import { ClassifyLeadPerformerService } from "./classify-lead-performer.service"
import { WorkPerformersErrorCode } from "./errors/work-performers.error"
import { PerformerKitService } from "./performer-kit.service"
import { PROMPT_WRITER } from "./work-performers.decorators"
import type { PromptWriter } from "./work-performers.port"

const ctx: WorkContext = { workspaceId: "ws-1", actor: "Lan", locale: "en" }

const itemOf = builder<WorkItem>({
    id: "item-1",
    workspace_id: "ws-1",
    department: "sales",
    action: "classify_lead",
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
    proposal: { summary: "Classify", fields: {} },
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
})

const leadOf = builder<LeadRecordRow>({
    id: "lead-1",
    workspace_id: "ws-1",
    contact_name: "Lan",
    company: "Hue Tea",
    channel: "zalo",
    need: "wholesale",
    stage: "new",
    context_summary: null,
    phone: null,
    email: null,
    origin: "live",
})

const responsibility: ResponsibilityRecord = {
    id: "resp-1",
    workspace_id: "ws-1",
    lead_id: "lead-1",
    title: "Follow Lan",
    owner_kind: "agent",
    owner_agent_id: "agent-1",
    owner_name: "Mai",
    next_action: "",
    due_at: null,
    status: "open",
    created_at: "2026-10-12T09:00:00.000Z",
}

const proposalOf = (fields: Proposal["fields"]): Proposal => ({ summary: "Classify", fields })

const build = async (lead: LeadRecordRow = leadOf()) => {
    const kit = mock<PerformerKitService>()
    kit.text.mockImplementation((_ctx, key, params = {}) => [key, ...Object.values(params).map(String)].join("|"))
    kit.stage.mockImplementation((_ctx, stage) => `stage.${stage}`)
    kit.scope.mockReturnValue({ workspaceId: "ws-1", locale: "en" })
    kit.leadInput.mockReturnValue({ contact_name: "Lan", company: "Hue Tea", channel: "zalo", need: "wholesale" })
    kit.brief.mockResolvedValue("brief")
    kit.department.mockResolvedValue("Sales")
    const leads = mock<LeadRecordsService>()
    leads.require.mockResolvedValue(lead)
    const events = mock<EventsService>()
    events.leadHistory.mockResolvedValue([
        { summary: "Asked the price", evidence: "50 boxes?" },
        { summary: "Called", evidence: null },
    ])
    const writer = mock<PromptWriter>()
    const responsibilities = mock<ResponsibilityJournalService>()
    responsibilities.ensureFor.mockResolvedValue(responsibility)
    const evidence = mock<EvidenceService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            ClassifyLeadPerformerService,
            { provide: PerformerKitService, useValue: kit },
            { provide: LeadRecordsService, useValue: leads },
            { provide: EventsService, useValue: events },
            { provide: PROMPT_WRITER, useValue: writer },
            { provide: ResponsibilityJournalService, useValue: responsibilities },
            { provide: EvidenceService, useValue: evidence },
        ],
    }).compile()
    return {
        service: moduleRef.get(ClassifyLeadPerformerService),
        leads,
        events,
        writer,
        responsibilities,
        evidence,
    }
}

describe("ClassifyLeadPerformerService prepare", () => {
    it("proposes a clear stage, the next step, the gaps and the context from the history", async () => {
        const { service, events, writer } = await build()
        writer.classifyLead.mockResolvedValue({
            stage: "qualified",
            confidence: 0.82,
            next_action: "Send the quote",
            missing: ["budget", "date"],
            context: "Wants 50 boxes",
        })

        await expect(service.prepare(ctx, itemOf())).resolves.toEqual({
            proposal: {
                summary: "classifySummary|Lan|stage.qualified|82",
                confidence: 0.82,
                outcome: "clear",
                fields: {
                    stage: "qualified",
                    next_action: "Send the quote",
                    context: "Wants 50 boxes",
                    missing: "budget, date",
                },
            },
        })
        expect(events.leadHistory).toHaveBeenCalledWith("ws-1", "lead-1", 12)
        expect(writer.classifyLead.mock.calls[0]?.[2]).toEqual(["Asked the price: 50 boxes?", "Called"])
    })

    it("marks a low confidence unclear and nothing missing as null", async () => {
        const { service, writer } = await build()
        writer.classifyLead.mockResolvedValue({
            stage: "new",
            confidence: 0.4,
            next_action: "",
            missing: [],
            context: "",
        })

        const prepared = await service.prepare(ctx, itemOf())

        expect(prepared.proposal.outcome).toBe("unclear")
        expect(prepared.proposal.fields.missing).toBeNull()
    })

    it("refuses an item without a customer", async () => {
        const { service } = await build()

        await expect(service.prepare(ctx, itemOf({ lead_id: null }))).rejects.toMatchObject({
            code: WorkPerformersErrorCode.SubjectMissing,
        })
    })
})

describe("ClassifyLeadPerformerService perform", () => {
    it("moves an open deal, sets the next step and keeps the first context brief", async () => {
        const { service, leads, responsibilities, evidence } = await build()
        const proposal = proposalOf({
            stage: "qualified",
            next_action: "Send the quote",
            context: "Wants 50 boxes",
        })

        await expect(service.perform(ctx, itemOf(), proposal)).resolves.toEqual({
            summary: "classified|Lan|stage.qualified|Send the quote",
            evidence: "captured",
            href: "/leads/lead-1",
            lead_id: "lead-1",
        })
        expect(leads.classify).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            leadId: "lead-1",
            stage: "qualified",
            contextSummary: "Wants 50 boxes",
        })
        expect(responsibilities.setNextAction).toHaveBeenCalledWith(ctx, "resp-1", "Send the quote")
        expect(evidence.log).toHaveBeenCalledWith(ctx, {
            lead_id: "lead-1",
            work_item_id: "item-1",
            kind: "context.summarised",
            actor: "Sales",
            summary: "contextCreated",
            evidence: "Wants 50 boxes",
        })
    })

    it("keeps a closed deal where it is and writes no next step or brief", async () => {
        const { service, leads, responsibilities, evidence } = await build(leadOf({ stage: "won" }))

        await expect(service.perform(ctx, itemOf(), proposalOf({ stage: "lost" }))).resolves.toMatchObject({
            summary: "classified|Lan|stage.won|—",
        })
        expect(leads.classify.mock.calls[0]?.[0].contextSummary).toBeNull()
        expect(responsibilities.ensureFor).not.toHaveBeenCalled()
        expect(evidence.log).not.toHaveBeenCalled()
    })

    it("never marks an open deal won and ignores a text that is not a stage", async () => {
        const { service, leads } = await build()

        const won = await service.perform(ctx, itemOf(), proposalOf({ stage: "won" }))
        const unknown = await service.perform(ctx, itemOf(), proposalOf({ stage: "maybe" }))

        expect(won.summary).toBe("classified|Lan|stage.new|—")
        expect(unknown.summary).toBe("classified|Lan|stage.new|—")
        expect(leads.classify.mock.calls[1]?.[0].stage).toBeNull()
    })

    it("does not rewrite a context brief the customer already has", async () => {
        const { service, evidence } = await build(leadOf({ context_summary: "Old brief" }))

        await service.perform(ctx, itemOf(), proposalOf({ stage: "proposal", context: "New brief" }))

        expect(evidence.log).not.toHaveBeenCalled()
    })

    it("refuses an item without a customer", async () => {
        const { service } = await build()

        await expect(service.perform(ctx, itemOf({ lead_id: null }), proposalOf({}))).rejects.toMatchObject({
            code: WorkPerformersErrorCode.SubjectMissing,
        })
    })
})
