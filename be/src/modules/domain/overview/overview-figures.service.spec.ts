import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { AgentConversationsReadService } from "@modules/domain/agent-conversations"
import { AgentDirectoryService } from "@modules/domain/agents"
import { AuthorityService } from "@modules/domain/authority"
import type { AuthorityProfile } from "@modules/domain/authority"
import { DecisionsFiguresService } from "@modules/domain/decisions"
import { EventsReadService } from "@modules/domain/events"
import { ExecutionsFiguresService } from "@modules/domain/executions"
import { InvoicesFiguresService } from "@modules/domain/invoices"
import { LeadReadService, LeadRecordsService } from "@modules/domain/leads"
import { OrdersFiguresService } from "@modules/domain/orders"
import { ResponsibilityReadService } from "@modules/domain/responsibilities"
import { TransactionsFiguresService } from "@modules/domain/transactions"
import { WorkItemsReadService } from "@modules/domain/work-items"
import { OverviewFiguresService } from "./overview-figures.service"
import { windowAt } from "./overview.policy"

const WINDOW = windowAt(new Date("2026-10-13T03:00:00.000Z"))
const AT = new Date("2026-10-01T00:00:00.000Z")
const AT_TEXT = "2026-10-01T00:00:00.000Z"

const BOT_SHEET = {
    id: "bot-1",
    knowledge: "hours",
    module: "chatbot",
    name: "Bot",
    handle: "bot",
    role: "",
    instructions: "",
    greeting: "",
    approvalRule: "",
    status: "active",
    createdAt: AT,
}

type WorkFigure = Awaited<ReturnType<WorkItemsReadService["newestFigures"]>>[number]

const workFigureOf = builder<WorkFigure>({
    id: "w-1",
    leadId: "l-1",
    department: "sales",
    status: "done",
    reason: null,
    decidedPath: null,
    createdAt: AT,
    updatedAt: AT,
    completedAt: AT,
    summary: null,
    contact: null,
    customer: null,
})

/** A decision as the recent list returns it. */
type RecentDecision = Awaited<ReturnType<DecisionsFiguresService["recent"]>>[number]

const decisionOf = builder<RecentDecision>({
    id: "d-1",
    workItemId: "w-1",
    leadId: "l-1",
    department: "sales",
    action: "reply",
    decidedBy: "Lan",
    deciderKind: "human",
    outcome: "approved",
    reason: null,
    note: null,
    createdAt: AT,
})

const build = async () => {
    const agents = mock<AgentDirectoryService>()
    const events = mock<EventsReadService>()
    const leads = mock<LeadReadService>()
    const leadRecords = mock<LeadRecordsService>()
    const conversations = mock<AgentConversationsReadService>()
    const executions = mock<ExecutionsFiguresService>()
    const responsibilities = mock<ResponsibilityReadService>()
    const authority = mock<AuthorityService>()
    const orders = mock<OrdersFiguresService>()
    const invoices = mock<InvoicesFiguresService>()
    const transactions = mock<TransactionsFiguresService>()
    const work = mock<WorkItemsReadService>()
    const decisions = mock<DecisionsFiguresService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            OverviewFiguresService,
            { provide: AgentDirectoryService, useValue: agents },
            { provide: EventsReadService, useValue: events },
            { provide: LeadReadService, useValue: leads },
            { provide: LeadRecordsService, useValue: leadRecords },
            { provide: AgentConversationsReadService, useValue: conversations },
            { provide: ExecutionsFiguresService, useValue: executions },
            { provide: ResponsibilityReadService, useValue: responsibilities },
            { provide: AuthorityService, useValue: authority },
            { provide: OrdersFiguresService, useValue: orders },
            { provide: InvoicesFiguresService, useValue: invoices },
            { provide: TransactionsFiguresService, useValue: transactions },
            { provide: WorkItemsReadService, useValue: work },
            { provide: DecisionsFiguresService, useValue: decisions },
        ],
    }).compile()
    return {
        service: moduleRef.get(OverviewFiguresService),
        agents,
        events,
        leads,
        leadRecords,
        conversations,
        executions,
        responsibilities,
        authority,
        orders,
        invoices,
        transactions,
        work,
        decisions,
    }
}

describe("OverviewFiguresService.promo", () => {
    it("composes the onboarding facts from the owners' reads", async () => {
        const world = await build()
        world.agents.earliestSheetOfModule.mockResolvedValue(BOT_SHEET)
        world.events.existsOfKindBetween.mockResolvedValue(true)
        world.leads.websiteOf.mockResolvedValue([{ id: "l-web", createdAt: AT }])
        world.conversations.hasCustomerChat.mockResolvedValue(true)
        world.conversations.hasLeadChat.mockResolvedValue(false)
        world.executions.countApproved.mockResolvedValue(2)
        world.events.firstAtByLead.mockResolvedValue([{ leadId: "l-web", at: new Date("2026-10-01T01:00:00.000Z") }])
        world.leads.idsAtStage.mockResolvedValue(["l-won"])
        world.events.existsOfKindForLeads.mockResolvedValue(true)
        world.responsibilities.idsTitledLike.mockResolvedValue(["r-1"])
        world.executions.hasApprovedAmong.mockResolvedValue(true)

        await expect(world.service.promo("ws-1", WINDOW)).resolves.toEqual({
            chatbot: { id: "bot-1", knowledge: "hours" },
            isFoundingMember: true,
            websiteLeads: [{ id: "l-web", createdAt: AT_TEXT }],
            firstEvents: [{ leadId: "l-web", at: "2026-10-01T01:00:00.000Z" }],
            hasCustomerConversation: true,
            hasLeadConversation: false,
            approvedCount: 2,
            hasWon: true,
            invoiceApproved: true,
        })
        expect(world.events.existsOfKindBetween).toHaveBeenCalledWith(
            "ws-1",
            "module.purchased",
            new Date(WINDOW.foundingFrom),
            new Date(WINDOW.foundingTo),
        )
        expect(world.events.firstAtByLead).toHaveBeenCalledWith(
            "ws-1",
            ["execution.approved", "responsibility.assigned"],
            ["l-web"],
        )
        expect(world.events.existsOfKindForLeads).toHaveBeenCalledWith("ws-1", "outcome.recorded", ["l-won"])
        expect(world.responsibilities.idsTitledLike).toHaveBeenCalledWith(
            "ws-1",
            ["Prepare invoice%", "Chu\u1EA9n b\u1ECB h\u00F3a \u0111\u01A1n%"],
            5000,
        )
        expect(world.executions.hasApprovedAmong).toHaveBeenCalledWith("ws-1", ["r-1"])
    })

    it("answers blank facts for a workspace that recorded nothing", async () => {
        const world = await build()
        world.agents.earliestSheetOfModule.mockResolvedValue(null)
        world.events.existsOfKindBetween.mockResolvedValue(false)
        world.leads.websiteOf.mockResolvedValue([])
        world.conversations.hasCustomerChat.mockResolvedValue(false)
        world.conversations.hasLeadChat.mockResolvedValue(false)
        world.executions.countApproved.mockResolvedValue(0)
        world.events.firstAtByLead.mockResolvedValue([])
        world.leads.idsAtStage.mockResolvedValue([])
        world.events.existsOfKindForLeads.mockResolvedValue(false)
        world.responsibilities.idsTitledLike.mockResolvedValue([])
        world.executions.hasApprovedAmong.mockResolvedValue(false)

        await expect(world.service.promo("ws-1", WINDOW)).resolves.toEqual({
            chatbot: null,
            isFoundingMember: false,
            websiteLeads: [],
            firstEvents: [],
            hasCustomerConversation: false,
            hasLeadConversation: false,
            approvedCount: 0,
            hasWon: false,
            invoiceApproved: false,
        })
    })
})

const quiet = (world: Awaited<ReturnType<typeof build>>) => {
    world.authority.profileOf.mockResolvedValue(null)
    world.leads.summariesOf.mockResolvedValue([])
    world.orders.confirmedOrBeyond.mockResolvedValue([])
    world.invoices.issuedOrPaid.mockResolvedValue([])
    world.transactions.openCredits.mockResolvedValue([])
    world.work.newestFigures.mockResolvedValue([])
    world.executions.countPendingWithoutWork.mockResolvedValue(0)
    world.decisions.since.mockResolvedValue([])
    world.decisions.recent.mockResolvedValue([])
    world.leadRecords.namesOf.mockResolvedValue([])
}

describe("OverviewFiguresService.governance", () => {
    it("answers null authority and zero counts when the rows are missing", async () => {
        const world = await build()
        quiet(world)

        await expect(world.service.governance("ws-1", WINDOW.since7)).resolves.toEqual({
            authority: null,
            leads: [],
            orders: [],
            invoices: [],
            transactions: [],
            work: [],
            pendingWithoutWork: 0,
            decisions7: [],
            recent: [],
        })
        expect(world.decisions.since).toHaveBeenCalledWith("ws-1", new Date(WINDOW.since7))
        expect(world.leads.summariesOf).toHaveBeenCalledWith("ws-1", 10_000)
        expect(world.work.newestFigures).toHaveBeenCalledWith("ws-1", 2000)
        expect(world.decisions.recent).toHaveBeenCalledWith("ws-1", 40)
    })
})

describe("OverviewFiguresService.governance rows", () => {
    it("composes the rows of every block, the pending count and the lead name of each recent decision", async () => {
        const world = await build()
        quiet(world)
        world.authority.profileOf.mockResolvedValue(
            mock<AuthorityProfile>({ goal_revenue_vnd: 5, goal_new_customers: 2, goal_first_reply_minutes: 3 }),
        )
        world.leads.summariesOf.mockResolvedValue([
            { id: "l-1", contactName: "An", company: "Co", stage: "new", createdAt: AT },
        ])
        world.orders.confirmedOrBeyond.mockResolvedValue([
            { id: "o-1", leadId: "l-1", orderNo: "SO-1", items: "tea", amountVnd: 10, status: "paid" },
        ])
        world.invoices.issuedOrPaid.mockResolvedValue([
            { id: "i-1", orderId: "o-1", leadId: "l-1", invoiceNo: "INV-1", amountVnd: 10, status: "paid" },
        ])
        world.transactions.openCredits.mockResolvedValue([
            { id: "t-1", invoiceId: "i-1", payer: "An", reference: "R", amountVnd: 10, status: "matched" },
        ])
        world.work.newestFigures.mockResolvedValue([
            workFigureOf(),
            workFigureOf({ id: "w-2", leadId: null, status: "queued", completedAt: null }),
        ])
        world.executions.countPendingWithoutWork.mockResolvedValue(4)
        world.decisions.since.mockResolvedValue([
            { workItemId: "w-1", leadId: "l-1", deciderKind: "human", outcome: "approved", createdAt: AT },
        ])
        world.decisions.recent.mockResolvedValue([
            decisionOf(),
            decisionOf({ id: "d-2", workItemId: null, leadId: null }),
            decisionOf({ id: "d-3", workItemId: null, leadId: "l-gone" }),
        ])
        world.leadRecords.namesOf.mockResolvedValue([{ id: "l-1", contact_name: "An" }])

        const governance = await world.service.governance("ws-1", WINDOW.since7)

        expect(governance.authority).toEqual({ goalRevenueVnd: 5, goalNewCustomers: 2, goalFirstReplyMinutes: 3 })
        expect(governance.leads).toEqual([
            { id: "l-1", contactName: "An", company: "Co", stage: "new", createdAt: AT_TEXT },
        ])
        expect(governance.orders).toHaveLength(1)
        expect(governance.invoices).toHaveLength(1)
        expect(governance.transactions).toHaveLength(1)
        expect(governance.work.map((item) => [item.id, item.completedAt])).toEqual([
            ["w-1", AT_TEXT],
            ["w-2", null],
        ])
        expect(governance.pendingWithoutWork).toBe(4)
        expect(governance.decisions7).toEqual([
            { workItemId: "w-1", leadId: "l-1", deciderKind: "human", outcome: "approved", createdAt: AT_TEXT },
        ])
        expect(governance.recent.map((decision) => [decision.id, decision.leadName])).toEqual([
            ["d-1", "An"],
            ["d-2", null],
            ["d-3", null],
        ])
        expect(world.leadRecords.namesOf).toHaveBeenCalledWith("ws-1", ["l-1", "l-gone"])
    })
})
