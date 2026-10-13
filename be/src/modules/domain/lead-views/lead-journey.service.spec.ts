import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AgentsService } from "@modules/domain/agents"
import { EventsService } from "@modules/domain/events"
import { ExecutionsService } from "@modules/domain/executions"
import type { LeadView } from "@modules/domain/leads"
import { LeadReadService } from "@modules/domain/leads"
import type { ResponsibilityRecord } from "@modules/domain/responsibilities"
import { ResponsibilityJournalService } from "@modules/domain/responsibilities"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { LeadJourneyService } from "./lead-journey.service"

const MEMBER: WorkspaceMember = {
    userId: "user-1",
    workspaceId: "ws-1",
    role: "owner",
    staffId: null,
    displayName: "An",
    status: "active",
}

const LEAD: LeadView = {
    id: "lead-1",
    contact_name: "Lan",
    company: "Shop",
    channel: "zalo",
    need: "menu",
    stage: "new",
    context_summary: null,
    origin: "live",
    installation_id: null,
    created_at: "2026-10-12T00:00:00.000Z",
}

const STEP: ResponsibilityRecord = {
    id: "step-1",
    workspace_id: "ws-1",
    lead_id: "lead-1",
    title: "Follow up",
    owner_kind: "human",
    owner_agent_id: null,
    owner_name: "An",
    next_action: "Call",
    due_at: null,
    status: "open",
    created_at: "2026-10-12T01:00:00.000Z",
}

const build = async () => {
    const members = mock<WorkspaceMembersService>()
    members.require.mockResolvedValue(MEMBER)
    const leads = mock<LeadReadService>()
    leads.require.mockResolvedValue(LEAD)
    const responsibilities = mock<ResponsibilityJournalService>()
    responsibilities.listForLead.mockResolvedValue([STEP])
    const events = mock<EventsService>()
    events.list.mockResolvedValue([])
    const agents = mock<AgentsService>()
    agents.list.mockResolvedValue([])
    const executions = mock<ExecutionsService>()
    executions.list.mockResolvedValue([])
    const moduleRef = await Test.createTestingModule({
        providers: [
            LeadJourneyService,
            { provide: WorkspaceMembersService, useValue: members },
            { provide: LeadReadService, useValue: leads },
            { provide: ResponsibilityJournalService, useValue: responsibilities },
            { provide: EventsService, useValue: events },
            { provide: AgentsService, useValue: agents },
            { provide: ExecutionsService, useValue: executions },
        ],
    }).compile()
    return { service: moduleRef.get(LeadJourneyService), executions }
}

describe("LeadJourneyService", () => {
    it("returns the lead, its steps and the empty owned lists beside them", async () => {
        const { service, executions } = await build()

        await expect(service.read("user-1", "ws-1", "lead-1")).resolves.toEqual({
            lead: LEAD,
            responsibilities: [STEP],
            executions: [],
            events: [],
            agents: [],
        })

        expect(executions.list).toHaveBeenCalledWith("ws-1", { responsibilityIds: ["step-1"], limit: 500 })
    })
})
