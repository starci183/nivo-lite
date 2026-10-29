import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { OverviewService } from "./overview.service"
import type {
    OverviewAgent,
    OverviewEvent,
    OverviewException,
    OverviewLead,
    OverviewPending,
    OverviewResponsibility,
} from "./overview.contracts"
import { OverviewFiguresService } from "./overview-figures.service"
import { OverviewReadsService } from "./overview-reads.service"

const SINCE7 = "2026-10-06T03:00:00.000Z"
const FOUNDING_FROM = "2026-09-28T17:00:00.000Z"
const FOUNDING_TO = "2026-10-31T16:59:59.000Z"

const AT = "2026-10-12T00:00:00+00:00"
const RESPONSIBILITY: OverviewResponsibility = {
    id: "r-1",
    leadId: "l-1",
    title: "Call",
    ownerKind: "human",
    ownerAgentId: null,
    ownerName: "Mai",
    nextAction: "call",
    dueAt: null,
    status: "open",
    createdAt: AT,
    lead: { id: "l-1", contactName: "An", company: "Co", stage: "new" },
}
const AGENT: OverviewAgent = {
    id: "a-1",
    module: "sales",
    name: "AI Sales",
    handle: "ai-sales",
    role: "sales",
    instructions: "x",
    knowledge: "",
    greeting: "",
    approvalRule: "",
    status: "active",
    createdAt: AT,
}
const EVENT: OverviewEvent = {
    id: "e-1",
    leadId: null,
    kind: "module.purchased",
    actor: "sys",
    summary: "bought",
    evidence: null,
    createdAt: AT,
}
const LEAD: OverviewLead = { id: "l-1", stage: "new", createdAt: AT, contactName: "An", company: "Co" }
const PENDING: OverviewPending = { id: "p-1", responsibilityId: "r-1", createdAt: AT, leadId: "l-1" }
const PROMO = {
    chatbot: { id: "bot-1", knowledge: "hours" },
    isFoundingMember: true,
    websiteLeads: [{ id: "l-web", createdAt: "2026-10-01T00:00:00.000Z" }],
    firstEvents: [{ leadId: "l-web", at: "2026-10-01T01:00:00.000Z" }],
    hasCustomerConversation: true,
    hasLeadConversation: true,
    approvedCount: 2,
    hasWon: true,
    invoiceApproved: true,
}
const GOVERNANCE = {
    authority: { goalRevenueVnd: 1, goalNewCustomers: 2, goalFirstReplyMinutes: 3 },
    leads: [],
    orders: [],
    invoices: [],
    transactions: [],
    work: [],
    pendingWithoutWork: 0,
    decisions7: [],
    recent: [],
}
const EXCEPTION: OverviewException = {
    id: "x-1",
    leadId: null,
    department: "sales",
    action: "quote",
    status: "failed",
    reason: null,
    error: null,
    executionId: null,
    assignedStaffName: null,
    createdAt: AT,
    summary: null,
    contact: null,
    customer: null,
    lead: null,
}

const EMPTY_PROMO = {
    chatbot: null,
    isFoundingMember: false,
    websiteLeads: [],
    firstEvents: [],
    hasCustomerConversation: false,
    hasLeadConversation: false,
    approvedCount: 0,
    hasWon: false,
    invoiceApproved: false,
}
const EMPTY_GOVERNANCE = {
    authority: null,
    leads: [],
    orders: [],
    invoices: [],
    transactions: [],
    work: [],
    pendingWithoutWork: 0,
    decisions7: [],
    recent: [],
}

const build = async () => {
    const reads = mock<OverviewReadsService>({
        responsibilities: jest.fn().mockResolvedValue([]),
        agents: jest.fn().mockResolvedValue([]),
        events: jest.fn().mockResolvedValue([]),
        leads: jest.fn().mockResolvedValue([]),
        pending: jest.fn().mockResolvedValue([]),
        exceptions: jest.fn().mockResolvedValue([]),
    })
    const figures = mock<OverviewFiguresService>({
        promo: jest.fn().mockResolvedValue(EMPTY_PROMO),
        governance: jest.fn().mockResolvedValue(EMPTY_GOVERNANCE),
    })
    const members = mock<WorkspaceMembersService>()
    members.require.mockResolvedValue({
        userId: "user-1",
        workspaceId: "ws-1",
        role: "owner",
        staffId: null,
        displayName: "Linh",
        status: "active",
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            OverviewService,
            { provide: OverviewReadsService, useValue: reads },
            { provide: OverviewFiguresService, useValue: figures },
            { provide: CLOCK, useValue: new FakeClock("2026-10-13T03:00:00.000Z") },
            { provide: WorkspaceMembersService, useValue: members },
        ],
    }).compile()
    return { service: moduleRef.get(OverviewService), members, reads, figures }
}

describe("OverviewService > dashboard", () => {
    it("reads every figure for an active member, in the founding window", async () => {
        const { service, members, reads, figures } = await build()
        reads.responsibilities.mockResolvedValue([RESPONSIBILITY])
        reads.agents.mockResolvedValue([AGENT])
        reads.events.mockResolvedValue([EVENT])
        reads.leads.mockResolvedValue([LEAD])
        reads.pending.mockResolvedValue([PENDING])
        reads.exceptions.mockResolvedValue([EXCEPTION])
        figures.promo.mockResolvedValue(PROMO)
        figures.governance.mockResolvedValue(GOVERNANCE)

        await expect(service.dashboard("user-1", "ws-1")).resolves.toEqual({
            since7: SINCE7,
            responsibilities: [RESPONSIBILITY],
            agents: [AGENT],
            events: [EVENT],
            leads: [LEAD],
            pending: [PENDING],
            promo: PROMO,
            governance: GOVERNANCE,
            exceptions: [EXCEPTION],
        })
        expect(members.require).toHaveBeenCalledWith("user-1", "ws-1")
        expect(reads.responsibilities).toHaveBeenCalledWith("ws-1")
        expect(reads.agents).toHaveBeenCalledWith("ws-1")
        expect(reads.events).toHaveBeenCalledWith("ws-1", 6)
        expect(reads.leads).toHaveBeenCalledWith("ws-1")
        expect(reads.pending).toHaveBeenCalledWith("ws-1")
        expect(reads.exceptions).toHaveBeenCalledWith("ws-1")
        expect(figures.promo).toHaveBeenCalledWith("ws-1", {
            since7: SINCE7,
            foundingFrom: FOUNDING_FROM,
            foundingTo: FOUNDING_TO,
        })
        expect(figures.governance).toHaveBeenCalledWith("ws-1", SINCE7)
    })

    it("answers empty lists and blank promo and governance when nothing is recorded", async () => {
        const { service } = await build()

        await expect(service.dashboard("user-1", "ws-1")).resolves.toEqual({
            since7: SINCE7,
            responsibilities: [],
            agents: [],
            events: [],
            leads: [],
            pending: [],
            promo: EMPTY_PROMO,
            governance: EMPTY_GOVERNANCE,
            exceptions: [],
        })
    })
})

describe("OverviewService > dashboard", () => {
    it("reads nothing when the caller is not a member", async () => {
        const denied = new Error("not a member")
        const { service, members, reads, figures } = await build()
        members.require.mockRejectedValue(denied)

        await expect(service.dashboard("user-1", "ws-9")).rejects.toBe(denied)
        expect(reads.responsibilities).not.toHaveBeenCalled()
        expect(figures.promo).not.toHaveBeenCalled()
    })
})
