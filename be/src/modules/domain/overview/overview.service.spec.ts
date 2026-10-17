import { Test } from "@nestjs/testing"
import { FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { OverviewService } from "./overview.service"
import {
    DASHBOARD_AGENTS,
    DASHBOARD_EVENTS,
    DASHBOARD_EXCEPTIONS,
    DASHBOARD_GOVERNANCE,
    DASHBOARD_LEADS,
    DASHBOARD_PENDING,
    DASHBOARD_PROMO,
    DASHBOARD_RESPONSIBILITIES,
} from "./persistence/overview.sql"

const SINCE7 = "2026-10-06T03:00:00.000Z"
const FOUNDING_FROM = "2026-09-28T17:00:00.000Z"
const FOUNDING_TO = "2026-10-31T16:59:59.000Z"

const RESPONSIBILITY = { id: "r-1" }
const AGENT = { id: "a-1" }
const EVENT = { id: "e-1" }
const LEAD = { id: "l-1" }
const PENDING = { id: "p-1" }
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
const EXCEPTION = { id: "x-1" }

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

const build = async (entityManager: MockEntityManager) => {
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
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: CLOCK, useValue: new FakeClock("2026-10-13T03:00:00.000Z") },
            { provide: WorkspaceMembersService, useValue: members },
        ],
    }).compile()
    return { service: moduleRef.get(OverviewService), members }
}

describe("OverviewService > dashboard", () => {
    it("reads every figure for an active member, in the founding window", async () => {
        const em = mockEntityManager({
            query: [
                [DASHBOARD_RESPONSIBILITIES, [{ rows: [RESPONSIBILITY] }]],
                [DASHBOARD_AGENTS, [{ rows: [AGENT] }]],
                [DASHBOARD_EVENTS, [{ rows: [EVENT] }]],
                [DASHBOARD_LEADS, [{ rows: [LEAD] }]],
                [DASHBOARD_PENDING, [{ rows: [PENDING] }]],
                [DASHBOARD_PROMO, [{ promo: PROMO }]],
                [DASHBOARD_GOVERNANCE, [{ governance: GOVERNANCE }]],
                [DASHBOARD_EXCEPTIONS, [{ rows: [EXCEPTION] }]],
            ],
        })
        const { service, members } = await build(em)

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
        expect(em.query).toHaveBeenCalledWith(DASHBOARD_RESPONSIBILITIES, ["ws-1"])
        expect(em.query).toHaveBeenCalledWith(DASHBOARD_AGENTS, ["ws-1"])
        expect(em.query).toHaveBeenCalledWith(DASHBOARD_EVENTS, ["ws-1", 6])
        expect(em.query).toHaveBeenCalledWith(DASHBOARD_LEADS, ["ws-1"])
        expect(em.query).toHaveBeenCalledWith(DASHBOARD_PENDING, ["ws-1"])
        expect(em.query).toHaveBeenCalledWith(DASHBOARD_PROMO, ["ws-1", FOUNDING_FROM, FOUNDING_TO])
        expect(em.query).toHaveBeenCalledWith(DASHBOARD_GOVERNANCE, ["ws-1", SINCE7])
        expect(em.query).toHaveBeenCalledWith(DASHBOARD_EXCEPTIONS, ["ws-1"])
    })

    it.each([
        { label: "a missing promo field", promo: [{}] },
        { label: "no promo row", promo: [] },
    ])("reads empty answers with $label as empty lists and blank promo and governance", async ({ promo }) => {
        const em = mockEntityManager({
            query: [
                [DASHBOARD_RESPONSIBILITIES, []],
                [DASHBOARD_AGENTS, [{}]],
                [DASHBOARD_EVENTS, [{ rows: null }]],
                [DASHBOARD_LEADS, [{ rows: [] }]],
                [DASHBOARD_PENDING, []],
                [DASHBOARD_PROMO, promo],
                [DASHBOARD_GOVERNANCE, []],
                [DASHBOARD_EXCEPTIONS, []],
            ],
        })
        const { service } = await build(em)

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
        const em = mockEntityManager()
        const { service, members } = await build(em)
        members.require.mockRejectedValue(denied)

        await expect(service.dashboard("user-1", "ws-9")).rejects.toBe(denied)
        expect(em.query).not.toHaveBeenCalled()
    })
})
