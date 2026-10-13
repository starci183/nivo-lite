import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { EvidenceService } from "@modules/domain/decisions"
import { InvoicesService } from "@modules/domain/invoices"
import type { LeadView } from "@modules/domain/leads"
import { LeadReadService } from "@modules/domain/leads"
import { OrdersService } from "@modules/domain/orders"
import { StaffDirectoryService } from "@modules/domain/staff"
import { TransactionsService } from "@modules/domain/transactions"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { WorkItemsService } from "@modules/domain/work-items"
import { LeadFlowService } from "./lead-flow.service"

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

const build = async () => {
    const members = mock<WorkspaceMembersService>()
    members.require.mockResolvedValue(MEMBER)
    const leads = mock<LeadReadService>()
    leads.require.mockResolvedValue(LEAD)
    const workItems = mock<WorkItemsService>()
    workItems.listForLead.mockResolvedValue([])
    const orders = mock<OrdersService>()
    orders.listForLead.mockResolvedValue([])
    const invoices = mock<InvoicesService>()
    invoices.listForLead.mockResolvedValue([])
    const transactions = mock<TransactionsService>()
    transactions.listForInvoices.mockResolvedValue([])
    const evidence = mock<EvidenceService>()
    evidence.listDecisions.mockResolvedValue([])
    const staff = mock<StaffDirectoryService>()
    staff.namesOf.mockResolvedValue([])
    const moduleRef = await Test.createTestingModule({
        providers: [
            LeadFlowService,
            { provide: WorkspaceMembersService, useValue: members },
            { provide: LeadReadService, useValue: leads },
            { provide: WorkItemsService, useValue: workItems },
            { provide: OrdersService, useValue: orders },
            { provide: InvoicesService, useValue: invoices },
            { provide: TransactionsService, useValue: transactions },
            { provide: EvidenceService, useValue: evidence },
            { provide: StaffDirectoryService, useValue: staff },
        ],
    }).compile()
    return moduleRef.get(LeadFlowService)
}

describe("LeadFlowService", () => {
    it("returns an empty journey after proving the caller belongs to the workspace", async () => {
        const service = await build()

        await expect(service.read("user-1", "ws-1", "lead-1")).resolves.toEqual({
            workItems: [],
            orders: [],
            invoices: [],
            transactions: [],
            decisions: [],
        })
    })
})
