import { Injectable } from "@nestjs/common"
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
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import type { SalesWorkbenchData } from "./sales-workbench.contracts"
import { autoDoneItemsOf, buildSalesWorkbench, conversationIdsOf } from "./sales-workbench.mapper"
import { viewOfWorkItem } from "./work-item-view.mapper"

@Injectable()
/** The Sales workbench, derived from the records its existing capabilities own. */
export class SalesWorkbenchService {
    constructor(
        private readonly members: WorkspaceMembersService,
        @InjectClock() private readonly clock: Clock,
        private readonly leads: LeadReadService,
        private readonly responsibilities: ResponsibilityJournalService,
        private readonly orders: OrdersService,
        private readonly invoices: InvoicesService,
        private readonly conversations: AgentConversationsService,
        private readonly messages: AgentMessagesService,
        private readonly executions: ExecutionsService,
        private readonly staff: StaffDirectoryService,
        private readonly events: EventsService,
        private readonly items: WorkItemsService,
        private readonly evidence: EvidenceService,
        private readonly contracts: ContractsService,
    ) {}

    /** Proves membership before reading every bounded region of the Sales workbench. */
    async read(userId: string, workspaceId: string): Promise<SalesWorkbenchData> {
        await this.members.require(userId, workspaceId)
        const [leads, steps, orders, invoices, conversations, drafts, staff, outcomes, items, decided, contracts] =
            await Promise.all([
                this.leads.list(workspaceId),
                this.responsibilities.listOpen(workspaceId),
                this.orders.listForWorkbench(workspaceId),
                this.invoices.listForWorkbench(workspaceId),
                this.conversations.listCustomerLeadConversations(workspaceId),
                this.executions.list(workspaceId, { pendingLegacy: true, limit: 50 }),
                this.staff.list(workspaceId),
                this.events.list(workspaceId, { kind: "outcome.recorded", limit: 600 }),
                this.items.listForWorkbench(workspaceId),
                this.evidence.listDecisions(workspaceId, { humanDepartment: "sales", limit: 15 }),
                this.contracts.list(workspaceId, userId),
            ])
        const [itemLeads, itemStaff] = await Promise.all([
            this.leads.listByIds(
                workspaceId,
                items.flatMap((item) => (item.lead_id === null ? [] : [item.lead_id])),
            ),
            this.staff.namesOf(
                workspaceId,
                items.flatMap((item) => (item.assigned_staff_id === null ? [] : [item.assigned_staff_id])),
            ),
        ])
        const views = items.map((item) => viewOfWorkItem(item, itemLeads, itemStaff))
        const [messages, autoEvidence] = await Promise.all([
            this.messages.listForConversations(workspaceId, conversationIdsOf(conversations), { limit: 800 }),
            this.events.list(workspaceId, {
                kind: "work.auto_done",
                workItemIds: autoDoneItemsOf(views).map((item) => item.id),
                limit: 200,
            }),
        ])
        return buildSalesWorkbench({
            nowMs: this.clock.now().getTime(),
            leads,
            steps,
            orders,
            invoices,
            conversations,
            messages,
            drafts,
            staff,
            outcomes,
            items: views,
            decided,
            autoEvidence,
            contracts,
            isTestRun: (...names) => names.some((name) => typeof name === "string" && /UAT|DBG/.test(name)),
        })
    }
}
