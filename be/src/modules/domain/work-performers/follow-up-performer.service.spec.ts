import { builder, mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { AgentsService } from "@modules/domain/agents"
import type { AgentProfile } from "@modules/domain/agents"
import { EvidenceService } from "@modules/domain/decisions"
import type { Proposal, WorkContext, WorkItem } from "@modules/domain/decisions"
import { ExecutionsService } from "@modules/domain/executions"
import { LeadRecordsService } from "@modules/domain/leads"
import type { LeadRecordRow } from "@modules/domain/leads"
import { ResponsibilityJournalService } from "@modules/domain/responsibilities"
import type { ResponsibilityRecord } from "@modules/domain/responsibilities"
import { WorkItemsService } from "@modules/domain/work-items"
import { CustomerDeliveryService } from "./customer-delivery.service"
import { WorkPerformersErrorCode } from "./errors/work-performers.error"
import { FollowUpPerformerService } from "./follow-up-performer.service"
import { PerformerKitService } from "./performer-kit.service"
import { PROMPT_WRITER } from "./work-performers.decorators"
import type { PromptWriter } from "./work-performers.port"

const ctx: WorkContext = { workspaceId: "ws-1", actor: "Lan", locale: "en" }

const itemOf = builder<WorkItem>({
    id: "item-1",
    workspace_id: "ws-1",
    department: "sales",
    action: "send_follow_up",
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
    proposal: { summary: "Follow up", fields: { responsibility_id: "resp-1" } },
    result: null,
    error: null,
    evidence_state: "pending",
    assigned_staff_id: null,
    execution_id: "exec-1",
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
    stage: "qualified",
    context_summary: "Wants 50 boxes",
    phone: "84901234567",
    email: null,
})

const responsibilityOf = builder<ResponsibilityRecord>({
    id: "resp-1",
    workspace_id: "ws-1",
    lead_id: "lead-1",
    title: "Follow Lan",
    owner_kind: "agent",
    owner_agent_id: "agent-1",
    owner_member_id: null,
    owner_name: "Mai",
    next_action: "Send the quote",
    due_at: null,
    status: "open",
    created_at: "2026-10-12T09:00:00.000Z",
})

const profileOf = (id: string): AgentProfile => ({
    id,
    name: "Mai",
    handle: "mai",
    role: "sales",
    instructions: "Be warm",
    knowledge: "",
    approval_rule: "",
})

const proposalOf = (fields: Proposal["fields"], draft?: string): Proposal => ({ summary: "Follow Lan", draft, fields })

const build = async (lead: LeadRecordRow = leadOf()) => {
    const kit = mock<PerformerKitService>()
    kit.text.mockImplementation((_ctx, key, params = {}) => [key, ...Object.values(params).map(String)].join("|"))
    kit.scope.mockReturnValue({ workspaceId: "ws-1", locale: "en" })
    kit.leadInput.mockReturnValue({ contact_name: "Lan", company: "Hue Tea", channel: "zalo", need: "wholesale" })
    kit.brief.mockResolvedValue("brief")
    const leads = mock<LeadRecordsService>()
    leads.require.mockResolvedValue(lead)
    const responsibilities = mock<ResponsibilityJournalService>()
    responsibilities.ensureFor.mockResolvedValue(responsibilityOf({ id: "resp-2", owner_agent_id: null }))
    const agents = mock<AgentsService>()
    const writer = mock<PromptWriter>()
    writer.draftFollowUp.mockResolvedValue("Hi Lan, here is the quote")
    const delivery = mock<CustomerDeliveryService>()
    delivery.contactOf.mockResolvedValue("84901234567")
    delivery.toCustomer.mockResolvedValue({ summary: "deliveredTelegram|Lan", real: true })
    const executions = mock<ExecutionsService>()
    executions.open.mockResolvedValue("exec-9")
    const workItems = mock<WorkItemsService>()
    const evidence = mock<EvidenceService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            FollowUpPerformerService,
            { provide: PerformerKitService, useValue: kit },
            { provide: LeadRecordsService, useValue: leads },
            { provide: ResponsibilityJournalService, useValue: responsibilities },
            { provide: AgentsService, useValue: agents },
            { provide: PROMPT_WRITER, useValue: writer },
            { provide: CustomerDeliveryService, useValue: delivery },
            { provide: ExecutionsService, useValue: executions },
            { provide: WorkItemsService, useValue: workItems },
            { provide: EvidenceService, useValue: evidence },
        ],
    }).compile()
    return {
        service: moduleRef.get(FollowUpPerformerService),
        responsibilities,
        agents,
        writer,
        delivery,
        executions,
        workItems,
        evidence,
    }
}

describe("FollowUpPerformerService prepare", () => {
    it("drafts the next message as the agent that owns the named responsibility", async () => {
        const { service, responsibilities, agents, writer } = await build()
        responsibilities.find.mockResolvedValue(responsibilityOf())
        agents.profileOf.mockResolvedValue(profileOf("agent-1"))

        await expect(service.prepare(ctx, itemOf())).resolves.toEqual({
            proposal: {
                summary: "followSummary|Lan",
                draft: "Hi Lan, here is the quote",
                fields: { responsibility_id: "resp-1", customer: "Lan", contact: "84901234567" },
            },
        })
        expect(responsibilities.find).toHaveBeenCalledWith("ws-1", "resp-1")
        expect(agents.profileOf).toHaveBeenCalledWith("ws-1", "agent-1")
        expect(writer.draftFollowUp).toHaveBeenCalledWith(
            { workspaceId: "ws-1", locale: "en" },
            { contact_name: "Lan", company: "Hue Tea", channel: "zalo", need: "wholesale" },
            "Wants 50 boxes",
            "Send the quote",
            profileOf("agent-1"),
            "brief",
        )
    })

    it("uses the customer's responsibility and the sales agent when none is named", async () => {
        const { service, responsibilities, agents, writer } = await build(leadOf({ context_summary: null }))
        agents.profileOfDepartment.mockResolvedValue(null)

        const prepared = await service.prepare(ctx, itemOf({ proposal: { summary: "s", fields: {} } }))

        expect(prepared.proposal.fields.responsibility_id).toBe("resp-2")
        expect(responsibilities.find).not.toHaveBeenCalled()
        expect(agents.profileOfDepartment).toHaveBeenCalledWith("ws-1", "sales")
        expect(writer.draftFollowUp.mock.calls[0]?.[2]).toBe("")
        expect(writer.draftFollowUp.mock.calls[0]?.[4]).toBeNull()
    })

    it("falls back to the customer's responsibility when the named one is gone", async () => {
        const { service, responsibilities } = await build()
        responsibilities.find.mockResolvedValue(null)

        const prepared = await service.prepare(ctx, itemOf())

        expect(prepared.proposal.fields.responsibility_id).toBe("resp-2")
    })

    it("refuses an item without a customer", async () => {
        const { service } = await build()

        await expect(service.prepare(ctx, itemOf({ lead_id: null }))).rejects.toMatchObject({
            code: WorkPerformersErrorCode.SubjectMissing,
        })
    })
})

describe("FollowUpPerformerService perform", () => {
    it("delivers the draft, approves the card and closes the responsibility", async () => {
        const { service, delivery, executions, responsibilities, evidence } = await build()
        const proposal = proposalOf({ responsibility_id: "resp-1" }, "Hi Lan")

        await expect(service.perform(ctx, itemOf(), proposal, { name: "Mai" })).resolves.toEqual({
            summary: "deliveredTelegram|Lan",
            evidence: "captured",
            href: "/leads/lead-1",
            lead_id: "lead-1",
            detail: "Hi Lan",
        })
        expect(delivery.toCustomer).toHaveBeenCalledWith(ctx, leadOf(), "Hi Lan")
        expect(executions.settle).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            executionId: "exec-1",
            decision: "approved",
            decidedBy: "Mai",
            editedDraft: "Hi Lan",
        })
        expect(executions.open).not.toHaveBeenCalled()
        expect(responsibilities.setStatus).toHaveBeenCalledWith(ctx, "resp-1", "done")
        expect(evidence.log).toHaveBeenCalledWith(ctx, {
            lead_id: "lead-1",
            work_item_id: "item-1",
            kind: "execution.approved",
            actor: "Mai",
            summary: "deliveredTelegram|Lan",
            evidence: "Hi Lan",
        })
    })

    it("opens and approves a card when the gate ran alone", async () => {
        const { service, agents, executions, workItems, responsibilities } = await build()
        agents.agentOfDepartment.mockResolvedValue({ id: "agent-1", name: "Mai" })

        const performed = await service.perform(ctx, itemOf({ execution_id: null }), proposalOf({}), {
            name: "NIVO",
        })

        expect(performed.detail).toBe("Follow Lan")
        expect(executions.open).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            responsibilityId: "resp-2",
            agentId: "agent-1",
            draft: "Follow Lan",
            workItemId: "item-1",
        })
        expect(workItems.attachExecution).toHaveBeenCalledWith("ws-1", "item-1", "exec-9")
        expect(executions.settle.mock.calls[0]?.[0].executionId).toBe("exec-9")
        expect(responsibilities.setStatus).toHaveBeenCalledWith(ctx, "resp-2", "done")
    })

    it("opens a card without an agent when Sales has none", async () => {
        const { service, agents, executions } = await build()
        agents.agentOfDepartment.mockResolvedValue(null)

        await service.perform(ctx, itemOf({ execution_id: null }), proposalOf({ responsibility_id: "resp-1" }), {
            name: "NIVO",
        })

        expect(executions.open.mock.calls[0]?.[0].agentId).toBeNull()
    })

    it("refuses an item without a customer", async () => {
        const { service } = await build()

        await expect(
            service.perform(ctx, itemOf({ lead_id: null }), proposalOf({}), { name: "Mai" }),
        ).rejects.toMatchObject({ code: WorkPerformersErrorCode.SubjectMissing })
    })
})

describe("FollowUpPerformerService onReject", () => {
    it("rejects the card and gives the responsibility back", async () => {
        const { service, executions, responsibilities } = await build()

        await expect(
            service.onReject(ctx, itemOf(), proposalOf({ responsibility_id: "resp-1" })),
        ).resolves.toBeUndefined()
        expect(executions.settle).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            executionId: "exec-1",
            decision: "rejected",
            decidedBy: "Lan",
            editedDraft: null,
        })
        expect(responsibilities.setStatus).toHaveBeenCalledWith(ctx, "resp-1", "open")
    })

    it("changes nothing without a card or a responsibility", async () => {
        const { service, executions, responsibilities } = await build()

        await expect(service.onReject(ctx, itemOf({ execution_id: null }), proposalOf({}))).resolves.toBeUndefined()
        expect(executions.settle).not.toHaveBeenCalled()
        expect(responsibilities.setStatus).not.toHaveBeenCalled()
    })
})
