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
    owner_member_id: "member-1",
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
    leads.listPage.mockResolvedValue({
        nodes: [LEAD, OTHER],
        pageInfo: { endCursor: "opaque-cursor", hasNextPage: true },
    })
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
    return { service: moduleRef.get(LeadBoardService), members, leads, responsibilities }
}

describe("LeadBoardService", () => {
    it("attaches the oldest open step's owner and next action, or null when a lead has none", async () => {
        const { service, members, leads, responsibilities } = await build()

        await expect(service.read("user-1", "ws-1", { first: 2 })).resolves.toEqual({
            nodes: [
                { ...LEAD, ownerName: "An", nextAction: "Call" },
                { ...OTHER, ownerName: null, nextAction: null },
            ],
            pageInfo: { endCursor: "opaque-cursor", hasNextPage: true },
        })
        expect(members.require).toHaveBeenCalledWith("user-1", "ws-1")
        expect(leads.listPage).toHaveBeenCalledWith("ws-1", { first: 2 })
        expect(responsibilities.listForBoard).toHaveBeenCalledWith("ws-1", [LEAD.id, OTHER.id])
    })

    it("reads responsibilities only for the current page, including older leads outside the original board window", async () => {
        const { service, leads, responsibilities } = await build()
        const olderLead = { ...LEAD, id: "old-lead", created_at: "2025-01-01T00:00:00.000Z" }
        leads.listPage.mockResolvedValue({
            nodes: [olderLead],
            pageInfo: { endCursor: "older-cursor", hasNextPage: false },
        })
        responsibilities.listForBoard.mockResolvedValue([{ ...STEP, lead_id: olderLead.id }])

        await expect(service.read("user-1", "ws-1", { after: "previous-cursor" })).resolves.toEqual({
            nodes: [{ ...olderLead, ownerName: "An", nextAction: "Call" }],
            pageInfo: { endCursor: "older-cursor", hasNextPage: false },
        })
        expect(responsibilities.listForBoard).toHaveBeenCalledWith("ws-1", [olderLead.id])
    })

    it("passes an empty lead page to the bounded responsibility reader", async () => {
        const { service, leads, responsibilities } = await build()
        leads.listPage.mockResolvedValue({ nodes: [], pageInfo: { endCursor: null, hasNextPage: false } })

        await expect(service.read("user-1", "ws-1", {})).resolves.toEqual({
            nodes: [],
            pageInfo: { endCursor: null, hasNextPage: false },
        })
        expect(responsibilities.listForBoard).toHaveBeenCalledWith("ws-1", [])
    })

    it("does not read responsibilities when the page cursor is refused", async () => {
        const { service, leads, responsibilities } = await build()
        const refusal = new Error("invalid page cursor")
        leads.listPage.mockRejectedValue(refusal)

        await expect(service.read("user-1", "ws-1", { after: "invalid-cursor" })).rejects.toThrow(refusal)

        expect(responsibilities.listForBoard).not.toHaveBeenCalled()
    })

    it("proves membership before reading either leads or their responsibilities", async () => {
        const { service, members, leads, responsibilities } = await build()
        const refusal = new Error("membership required")
        members.require.mockRejectedValue(refusal)

        await expect(service.read("user-1", "ws-1", {})).rejects.toThrow(refusal)

        expect(leads.listPage).not.toHaveBeenCalled()
        expect(responsibilities.listForBoard).not.toHaveBeenCalled()
    })
})
