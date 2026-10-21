import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { LeadView } from "@modules/domain/leads"
import { LeadReadService } from "@modules/domain/leads"
import type { ResponsibilityRecord } from "@modules/domain/responsibilities"
import { ResponsibilityJournalService } from "@modules/domain/responsibilities"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { LeadBoardService } from "./lead-board.service"

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
    installation_id: null,
    created_at: "2026-10-12T00:00:00.000Z",
}

const OTHER: LeadView = { ...LEAD, id: "lead-2", contact_name: "Minh" }

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
    leads.list.mockResolvedValue([LEAD, OTHER])
    const responsibilities = mock<ResponsibilityJournalService>()
    responsibilities.listForBoard.mockResolvedValue([STEP])
    const moduleRef = await Test.createTestingModule({
        providers: [
            LeadBoardService,
            { provide: WorkspaceMembersService, useValue: members },
            { provide: LeadReadService, useValue: leads },
            { provide: ResponsibilityJournalService, useValue: responsibilities },
        ],
    }).compile()
    return moduleRef.get(LeadBoardService)
}

describe("LeadBoardService", () => {
    it("attaches the oldest open step's owner and next action, or null when a lead has none", async () => {
        const service = await build()

        await expect(service.read("user-1", "ws-1")).resolves.toEqual([
            { ...LEAD, ownerName: "An", nextAction: "Call" },
            { ...OTHER, ownerName: null, nextAction: null },
        ])
    })
})
