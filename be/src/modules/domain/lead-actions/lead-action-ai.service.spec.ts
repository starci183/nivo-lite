import { Test } from "@nestjs/testing"
import { FakeClock, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { AgentsService } from "@modules/domain/agents"
import type { AgentProfile, AgentSummary } from "@modules/domain/agents"
import type { WorkContext } from "@modules/domain/decisions"
import { EventsService } from "@modules/domain/events"
import { LeadRecordsService } from "@modules/domain/leads"
import type { LeadRecordRow } from "@modules/domain/leads"
import { MessagesService } from "@modules/domain/messages"
import { ResponsibilityJournalService } from "@modules/domain/responsibilities"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { ResponsibilityListing } from "@modules/domain/responsibilities"
import { DEEPSEEK_CLIENT } from "@modules/integrations/deepseek"
import type { DeepseekClient, ProposedResponsibility } from "@modules/integrations/deepseek"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { LeadActionsErrorCode } from "./errors/lead-actions.error"
import { LeadActionAiService } from "./lead-action-ai.service"

const LEAD = "11111111-1111-4111-8111-111111111111"
const ctx: WorkContext = { workspaceId: "ws-1", actor: "Lan", locale: "vi" }

const lead: LeadRecordRow = {
    id: LEAD,
    workspace_id: "ws-1",
    contact_name: "Lan",
    company: "Hue Tea",
    channel: "zalo",
    need: "tea",
    stage: "qualified",
    context_summary: "buys tea",
    phone: null,
    email: null,
}

const open: ResponsibilityListing = {
    id: "resp-1",
    workspace_id: "ws-1",
    lead_id: LEAD,
    title: "Call back",
    owner_kind: "human",
    owner_agent_id: null,
    owner_member_id: "member-1",
    owner_name: "Lan",
    next_action: "Call",
    due_at: null,
    status: "open",
    created_at: "2026-10-14T00:00:00.000Z",
    contact_name: "Lan",
    company: "Hue Tea",
    leadStage: "qualified",
}

const sales: AgentSummary = {
    id: "agent-1",
    module: "sales",
    name: "Tea sales",
    handle: "tea-sales",
    role: "Sell tea",
    status: "active",
    createdAt: "2026-10-14T00:00:00.000Z",
}

const profile: AgentProfile = {
    id: sales.id,
    name: sales.name,
    handle: sales.handle,
    role: sales.role,
    instructions: "Follow up on tea orders",
    knowledge: "Hue Tea products",
    approval_rule: "Ask before discounts",
}

const proposal: ProposedResponsibility = {
    title: "Follow up on tea order",
    owner_kind: "agent",
    owner_handle: "tea-sales",
    next_action: "Send the tea catalogue",
    due_in_days: 2,
    rationale: "The sales agent knows the tea products",
}

const build = async () => {
    const tx = fakeTransaction(mockEntityManager())
    const leads = mock<LeadRecordsService>()
    leads.require.mockResolvedValue(lead)
    const events = mock<EventsService>()
    events.leadHistory.mockResolvedValue([{ summary: "asked about tea", evidence: null }])
    events.record.mockResolvedValue(undefined)
    const ai = mock<DeepseekClient>()
    ai.summarizeContext.mockResolvedValue("A tea buyer.")
    const responsibilities = mock<ResponsibilityJournalService>()
    responsibilities.list.mockResolvedValue([open])
    responsibilities.create.mockResolvedValue(open)
    const agents = mock<AgentsService>()
    agents.list.mockResolvedValue([sales])
    agents.profileOf.mockResolvedValue(profile)
    const messages = mock<MessagesService>()
    messages.postSystem.mockResolvedValue(undefined)
    const members = mock<WorkspaceMembersService>()
    members.idOf.mockResolvedValue("member-1")
    ai.proposeResponsibility.mockResolvedValue(proposal)
    const catalog = mock<MessageCatalog>()
    catalog.get.mockReturnValue("context refreshed")
    const moduleRef = await Test.createTestingModule({
        providers: [
            LeadActionAiService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: CLOCK, useValue: new FakeClock("2026-10-14T00:00:00.000Z") },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: LeadRecordsService, useValue: leads },
            { provide: EventsService, useValue: events },
            { provide: AgentsService, useValue: agents },
            { provide: ResponsibilityJournalService, useValue: responsibilities },
            { provide: MessagesService, useValue: messages },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: DEEPSEEK_CLIENT, useValue: ai },
        ],
    }).compile()
    return {
        ai: moduleRef.get(LeadActionAiService),
        leads,
        events,
        model: ai,
        responsibilities,
        agents,
        messages,
        members,
        catalog,
        tx,
    }
}

describe("LeadActionAiService", () => {
    it("stores the brief the model wrote and answers it", async () => {
        const { ai, leads, events } = await build()

        await expect(ai.refreshContext(ctx, LEAD)).resolves.toEqual({ leadId: LEAD, contextSummary: "A tea buyer." })
        expect(leads.replaceContext).toHaveBeenCalledWith("ws-1", LEAD, "A tea buyer.", expect.anything())
        expect(events.record).toHaveBeenCalledWith(
            expect.objectContaining({ kind: "context.summarised", evidence: "A tea buyer." }),
            expect.anything(),
        )
    })

    it("keeps an open responsibility instead of proposing another", async () => {
        const { ai, model } = await build()

        await expect(ai.suggestOwner(ctx, "user-1", LEAD)).resolves.toEqual({
            leadId: LEAD,
            responsibilityId: "resp-1",
        })
        expect(model.proposeResponsibility).not.toHaveBeenCalled()
    })

    it("passes the lead history to the model and records the localized context event in one transaction", async () => {
        const { ai, leads, events, model, catalog, tx } = await build()

        await expect(ai.refreshContext(ctx, LEAD)).resolves.toEqual({ leadId: LEAD, contextSummary: "A tea buyer." })

        expect(leads.require).toHaveBeenCalledWith("ws-1", LEAD)
        expect(events.leadHistory).toHaveBeenCalledWith("ws-1", LEAD, 500)
        expect(model.summarizeContext).toHaveBeenCalledWith(ctx, lead, ["asked about tea"])
        expect(catalog.get).toHaveBeenCalledWith("lead-actions.context", {}, "vi")
        const manager = leads.replaceContext.mock.calls[0]?.[3]
        expect(manager).toBeDefined()
        expect(events.record).toHaveBeenCalledWith(
            {
                workspaceId: "ws-1",
                leadId: LEAD,
                kind: "context.summarised",
                actor: "NIVO AI",
                summary: "context refreshed",
                evidence: "A tea buyer.",
            },
            manager,
        )
        expect(tx.outcomes).toEqual(["commit"])
    })
})

describe("LeadActionAiService", () => {
    it("assigns the matching active sales profile and records the next action and owner message together", async () => {
        const { ai, model, responsibilities, agents, events, messages, catalog, tx } = await build()
        responsibilities.list.mockResolvedValue([
            { ...open, status: "done" },
            { ...open, id: "unrelated", lead_id: "other-lead" },
        ])
        const chosen = { ...profile, id: "agent-2", handle: "tea-expert" }
        agents.list.mockResolvedValue([
            { ...sales, id: "support-1", module: "support" },
            sales,
            { ...sales, id: chosen.id, handle: chosen.handle },
            { ...sales, id: "missing-profile" },
            { ...sales, id: "paused-sales", status: "paused" },
        ])
        agents.profileOf.mockResolvedValueOnce(profile).mockResolvedValueOnce(chosen).mockResolvedValueOnce(null)
        model.proposeResponsibility.mockResolvedValue({ ...proposal, owner_handle: chosen.handle })
        responsibilities.create.mockResolvedValue({ ...open, id: "new-resp", next_action: "Persisted next action" })
        catalog.get.mockReturnValue("Owner assigned")

        await expect(ai.suggestOwner(ctx, "user-1", LEAD)).resolves.toEqual({
            leadId: LEAD,
            responsibilityId: "new-resp",
        })

        expect(responsibilities.list).toHaveBeenCalledWith("user-1", "ws-1")
        expect(agents.list).toHaveBeenCalledWith("user-1", "ws-1")
        expect(agents.profileOf.mock.calls).toEqual([
            ["ws-1", sales.id],
            ["ws-1", chosen.id],
            ["ws-1", "missing-profile"],
        ])
        expect(model.proposeResponsibility).toHaveBeenCalledWith(ctx, lead, "buys tea", [profile, chosen], "Lan")
        const manager = responsibilities.create.mock.calls[0]?.[3]
        expect(manager).toBeDefined()
        expect(responsibilities.create).toHaveBeenCalledWith(
            "user-1",
            "ws-1",
            {
                lead_id: LEAD,
                title: proposal.title,
                owner: chosen.id,
                next_action: proposal.next_action,
                due_at: "2026-10-16T00:00:00.000Z",
            },
            manager,
        )
        expect(events.record).toHaveBeenCalledWith(
            {
                workspaceId: "ws-1",
                leadId: LEAD,
                kind: "responsibility.proposed",
                actor: "NIVO AI",
                summary: "Persisted next action",
                evidence: proposal.rationale,
            },
            manager,
        )
        expect(catalog.get).toHaveBeenCalledWith(
            "lead-actions.owner",
            { name: "Lan", owner: "@tea-expert", next: "Persisted next action" },
            "vi",
        )
        expect(messages.postSystem).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            leadId: LEAD,
            manager,
            body: "Owner assigned",
        })
        expect(tx.outcomes).toEqual(["commit"])
    })
})

describe("LeadActionAiService", () => {
    it("falls back to the first eligible agent when the proposed handle is absent", async () => {
        const { ai, responsibilities, model, catalog } = await build()
        responsibilities.list.mockResolvedValue([])
        model.proposeResponsibility.mockResolvedValue({ ...proposal, owner_handle: "unknown-handle" })

        await expect(ai.suggestOwner(ctx, "user-1", LEAD)).resolves.toEqual({
            leadId: LEAD,
            responsibilityId: "resp-1",
        })

        expect(responsibilities.create).toHaveBeenCalledWith(
            "user-1",
            "ws-1",
            {
                lead_id: LEAD,
                title: proposal.title,
                owner: sales.id,
                next_action: proposal.next_action,
                due_at: "2026-10-16T00:00:00.000Z",
            },
            expect.anything(),
        )
        expect(catalog.get).toHaveBeenCalledWith(
            "lead-actions.owner",
            { name: "Lan", owner: "@tea-sales", next: "Call" },
            "vi",
        )
    })

    it("uses other active agents without sales agents and respects human proposals", async () => {
        const { ai, leads, model, responsibilities, agents, catalog, members } = await build()
        const unbriefedLead = { ...lead, context_summary: null }
        leads.require.mockResolvedValue(unbriefedLead)
        responsibilities.list.mockResolvedValue([])
        agents.list.mockResolvedValue([{ ...sales, module: "support" }])
        model.proposeResponsibility.mockResolvedValue({
            ...proposal,
            owner_kind: "human",
            owner_handle: null,
            due_in_days: 0,
        })

        await expect(ai.suggestOwner(ctx, "user-1", LEAD)).resolves.toEqual({
            leadId: LEAD,
            responsibilityId: "resp-1",
        })

        expect(members.idOf).toHaveBeenCalledWith("user-1", "ws-1")
        expect(agents.profileOf).toHaveBeenCalledWith("ws-1", sales.id)
        expect(model.proposeResponsibility).toHaveBeenCalledWith(ctx, unbriefedLead, "", [profile], "Lan")
        expect(responsibilities.create).toHaveBeenCalledWith(
            "user-1",
            "ws-1",
            {
                lead_id: LEAD,
                title: proposal.title,
                owner: "member-1",
                next_action: proposal.next_action,
                due_at: "2026-10-14T00:00:00.000Z",
            },
            expect.anything(),
        )
        expect(catalog.get).toHaveBeenCalledWith(
            "lead-actions.owner",
            { name: "Lan", owner: "Lan", next: "Call" },
            "vi",
        )
    })
})

describe("LeadActionAiService", () => {
    it("assigns a person when the model proposes an agent but there are no eligible profiles", async () => {
        const { ai, model, responsibilities, agents, catalog } = await build()
        responsibilities.list.mockResolvedValue([])
        agents.list.mockResolvedValue([{ ...sales, status: "paused" }])

        await expect(ai.suggestOwner(ctx, "user-1", LEAD)).resolves.toEqual({
            leadId: LEAD,
            responsibilityId: "resp-1",
        })

        expect(agents.profileOf).not.toHaveBeenCalled()
        expect(model.proposeResponsibility).toHaveBeenCalledWith(ctx, lead, "buys tea", [], "Lan")
        expect(responsibilities.create).toHaveBeenCalledWith(
            "user-1",
            "ws-1",
            {
                lead_id: LEAD,
                title: proposal.title,
                owner: "member-1",
                next_action: proposal.next_action,
                due_at: "2026-10-16T00:00:00.000Z",
            },
            expect.anything(),
        )
        expect(catalog.get).toHaveBeenCalledWith(
            "lead-actions.owner",
            { name: "Lan", owner: "Lan", next: "Call" },
            "vi",
        )
    })

    it("refuses an invalid model proposal before writing any responsibility, evidence, or message", async () => {
        const { ai, model, responsibilities, events, messages, tx } = await build()
        responsibilities.list.mockResolvedValue([])
        model.proposeResponsibility.mockResolvedValue({ ...proposal, title: " " })

        await expect(ai.suggestOwner(ctx, "user-1", LEAD)).rejects.toMatchObject({
            code: LeadActionsErrorCode.InvalidInput,
            params: { field: "title" },
        })

        expect(tx.outcomes).toEqual([])
        expect(responsibilities.create).not.toHaveBeenCalled()
        expect(events.record).not.toHaveBeenCalled()
        expect(messages.postSystem).not.toHaveBeenCalled()
    })
})
