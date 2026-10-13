import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { AgentConversationsService } from "@modules/domain/agent-conversations"
import { AgentMessagesService } from "@modules/domain/agent-messages"
import { ContractsService } from "@modules/domain/contracts"
import { EvidenceService } from "@modules/domain/decisions"
import { EventsService } from "@modules/domain/events"
import { ExecutionsService } from "@modules/domain/executions"
import { InvoicesService } from "@modules/domain/invoices"
import { LeadReadService } from "@modules/domain/leads"
import { OrdersService } from "@modules/domain/orders"
import { ResponsibilityJournalService } from "@modules/domain/responsibilities"
import { StaffDirectoryService } from "@modules/domain/staff"
import { WorkItemsService } from "@modules/domain/work-items"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { SalesWorkbenchService } from "./sales-workbench.service"

const NOW = "2026-10-13T10:00:00.000Z"
const MEMBER: WorkspaceMember = {
    userId: "user-1",
    workspaceId: "ws-1",
    role: "owner",
    staffId: null,
    displayName: "Owner",
    status: "active",
}

const build = async () => {
    const members = mock<WorkspaceMembersService>()
    const leads = mock<LeadReadService>()
    const responsibilities = mock<ResponsibilityJournalService>()
    const orders = mock<OrdersService>()
    const invoices = mock<InvoicesService>()
    const conversations = mock<AgentConversationsService>()
    const messages = mock<AgentMessagesService>()
    const executions = mock<ExecutionsService>()
    const staff = mock<StaffDirectoryService>()
    const events = mock<EventsService>()
    const items = mock<WorkItemsService>()
    const evidence = mock<EvidenceService>()
    const contracts = mock<ContractsService>()
    members.require.mockResolvedValue(MEMBER)
    leads.list.mockResolvedValue([])
    leads.listByIds.mockResolvedValue([])
    responsibilities.listOpen.mockResolvedValue([])
    orders.listForWorkbench.mockResolvedValue([])
    invoices.listForWorkbench.mockResolvedValue([])
    conversations.listCustomerLeadConversations.mockResolvedValue([])
    messages.listForConversations.mockResolvedValue([])
    executions.list.mockResolvedValue([])
    staff.list.mockResolvedValue([])
    staff.namesOf.mockResolvedValue([])
    events.list.mockResolvedValue([])
    items.listForWorkbench.mockResolvedValue([])
    evidence.listDecisions.mockResolvedValue([])
    contracts.list.mockResolvedValue([])
    const moduleRef = await Test.createTestingModule({
        providers: [
            SalesWorkbenchService,
            { provide: WorkspaceMembersService, useValue: members },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: LeadReadService, useValue: leads },
            { provide: ResponsibilityJournalService, useValue: responsibilities },
            { provide: OrdersService, useValue: orders },
            { provide: InvoicesService, useValue: invoices },
            { provide: AgentConversationsService, useValue: conversations },
            { provide: AgentMessagesService, useValue: messages },
            { provide: ExecutionsService, useValue: executions },
            { provide: StaffDirectoryService, useValue: staff },
            { provide: EventsService, useValue: events },
            { provide: WorkItemsService, useValue: items },
            { provide: EvidenceService, useValue: evidence },
            { provide: ContractsService, useValue: contracts },
        ],
    }).compile()
    return { workbench: moduleRef.get(SalesWorkbenchService), members }
}

describe("SalesWorkbenchService", () => {
    it("derives an empty workbench after proving membership", async () => {
        const { workbench, members } = await build()

        await expect(workbench.read("user-1", "ws-1")).resolves.toEqual({
            nowIso: NOW,
            metrics: {
                openCount: 0,
                proposalValueVnd: 0,
                proposalCount: 0,
                wonCount: 0,
                wonValueVnd: 0,
                waitingCount: 0,
                conversion: { windowDays: 90, leads: 0, won: 0, sources: [] },
            },
            attention: [],
            deals: [],
            closedHidden: { won: 0, lost: 0 },
            decisions: [],
            decided: [],
            handoffs: [],
            activity: [],
            staff: [],
            contracts: [],
            leadOptions: [],
        })
        expect(members.require).toHaveBeenCalledWith("user-1", "ws-1")
    })
})
