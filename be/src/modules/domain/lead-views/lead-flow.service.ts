import { Injectable } from "@nestjs/common"
import { EvidenceService } from "@modules/domain/decisions"
import { InvoicesService } from "@modules/domain/invoices"
import { OrdersService } from "@modules/domain/orders"
import { StaffDirectoryService } from "@modules/domain/staff"
import { TransactionsService } from "@modules/domain/transactions"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { WorkItemsService } from "@modules/domain/work-items"
import type { LeadFlowView } from "./lead-flow-view.contracts"
import { toLeadFlowView } from "./lead-flow-view.mapper"
import { LeadReadService } from "@modules/domain/leads"

@Injectable()
/** The complete customer journey, composed from the capabilities that own its records. */
export class LeadFlowService {
    constructor(
        private readonly members: WorkspaceMembersService,
        private readonly leads: LeadReadService,
        private readonly workItems: WorkItemsService,
        private readonly orders: OrdersService,
        private readonly invoices: InvoicesService,
        private readonly transactions: TransactionsService,
        private readonly evidence: EvidenceService,
        private readonly staff: StaffDirectoryService,
    ) {}

    /** Proves the caller's workspace access before reading the customer's journey. */
    async read(principalId: string, workspaceId: string, leadId: string): Promise<LeadFlowView> {
        await this.members.require(principalId, workspaceId)
        const lead = await this.leads.require(workspaceId, leadId)
        const [items, orders, invoices, decisions] = await Promise.all([
            this.workItems.listForLead(workspaceId, leadId),
            this.orders.listForLead(workspaceId, leadId),
            this.invoices.listForLead(workspaceId, leadId),
            this.evidence.listDecisions(workspaceId, { leadId, limit: 500, oldestFirst: true }),
        ])
        const assignedIds = items.flatMap((item) => (item.assigned_staff_id === null ? [] : [item.assigned_staff_id]))
        const [transactions, staff] = await Promise.all([
            this.transactions.listForInvoices(
                workspaceId,
                invoices.map((invoice) => invoice.id),
            ),
            this.staff.namesOf(workspaceId, [...new Set(assignedIds)]),
        ])
        return toLeadFlowView({
            workItems: items,
            lead,
            staff,
            orders: [...orders].sort(
                (left, right) => left.created_at.localeCompare(right.created_at) || left.id.localeCompare(right.id),
            ),
            invoices,
            transactions,
            decisions,
        })
    }
}
