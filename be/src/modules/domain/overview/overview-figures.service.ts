import { Injectable } from "@nestjs/common"
import { AgentConversationsReadService } from "@modules/domain/agent-conversations"
import { AgentDirectoryService } from "@modules/domain/agents"
import { AuthorityService } from "@modules/domain/authority"
import { DecisionsFiguresService } from "@modules/domain/decisions"
import { EventsReadService } from "@modules/domain/events"
import { ExecutionsFiguresService } from "@modules/domain/executions"
import { InvoicesFiguresService } from "@modules/domain/invoices"
import { LeadReadService, LeadRecordsService } from "@modules/domain/leads"
import { OrdersFiguresService } from "@modules/domain/orders"
import { ResponsibilityReadService } from "@modules/domain/responsibilities"
import { TransactionsFiguresService } from "@modules/domain/transactions"
import { WorkItemsReadService } from "@modules/domain/work-items"
import type { RawGovernance } from "./governance.policy"
import type { OverviewAuthority, OverviewDecision, OverviewPromo, OverviewWindow } from "./overview.contracts"
import { instant } from "./overview-reads.service"

/** How many leads the figures count. */
const LEAD_LIMIT = 10_000
/** How many work items the governance figures read. */
const WORK_LIMIT = 2000
/** How many recent decisions the governance block lists. */
const RECENT_DECISIONS = 40
/** The event kinds that answer a customer for the first time. */
const FIRST_RESPONSE_KINDS = ["execution.approved", "responsibility.assigned"] as const
/** The title patterns of the invoice-preparation step, in the two languages the rows were written in. */
const INVOICE_TITLES = ["Prepare invoice%", "Chu\u1EA9n b\u1ECB h\u00F3a \u0111\u01A1n%"] as const
/** How many invoice-preparation steps are checked for an approved execution. */
const INVOICE_STEP_LIMIT = 5000

/** The instant of an optional date as text. */
const optionalInstant = (at: Date | null): string | null => (at === null ? null : instant(at))

@Injectable()
/** The composite figures of the executive dashboard: the onboarding facts and the governance rows, each answered by the capability that owns them. */
export class OverviewFiguresService {
    constructor(
        private readonly agentDirectory: AgentDirectoryService,
        private readonly eventReads: EventsReadService,
        private readonly leadReads: LeadReadService,
        private readonly leadRecords: LeadRecordsService,
        private readonly conversations: AgentConversationsReadService,
        private readonly executionFigures: ExecutionsFiguresService,
        private readonly responsibilityReads: ResponsibilityReadService,
        private readonly authority: AuthorityService,
        private readonly orders: OrdersFiguresService,
        private readonly invoices: InvoicesFiguresService,
        private readonly transactions: TransactionsFiguresService,
        private readonly workReads: WorkItemsReadService,
        private readonly decisions: DecisionsFiguresService,
    ) {}

    /** The facts behind the onboarding checklist and the website lead stats. */
    async promo(workspaceId: string, window: OverviewWindow): Promise<OverviewPromo> {
        const [chatbot, isFoundingMember, websiteLeads, hasCustomerConversation, hasLeadConversation, approvedCount] =
            await Promise.all([
                this.agentDirectory.earliestSheetOfModule(workspaceId, "chatbot"),
                this.eventReads.existsOfKindBetween(
                    workspaceId,
                    "module.purchased",
                    new Date(window.foundingFrom),
                    new Date(window.foundingTo),
                ),
                this.leadReads.websiteOf(workspaceId),
                this.conversations.hasCustomerChat(workspaceId),
                this.conversations.hasLeadChat(workspaceId),
                this.executionFigures.countApproved(workspaceId),
            ])
        const [firstEvents, hasWon, invoiceApproved] = await Promise.all([
            this.eventReads.firstAtByLead(
                workspaceId,
                FIRST_RESPONSE_KINDS,
                websiteLeads.map((lead) => lead.id),
            ),
            this.hasWon(workspaceId),
            this.invoiceApproved(workspaceId),
        ])
        return {
            chatbot: chatbot === null ? null : { id: chatbot.id, knowledge: chatbot.knowledge },
            isFoundingMember,
            websiteLeads: websiteLeads.map((lead) => ({ id: lead.id, createdAt: instant(lead.createdAt) })),
            firstEvents: firstEvents.map((event) => ({ leadId: event.leadId, at: instant(event.at) })),
            hasCustomerConversation,
            hasLeadConversation,
            approvedCount,
            hasWon,
            invoiceApproved,
        }
    }

    /** The rows behind the governance figures. */
    async governance(workspaceId: string, since7: string): Promise<RawGovernance> {
        const [authority, leads, orders, invoices, transactions, work, pendingWithoutWork, decisions7, recent] =
            await Promise.all([
                this.authority.profileOf(workspaceId),
                this.leadReads.summariesOf(workspaceId, LEAD_LIMIT),
                this.orders.confirmedOrBeyond(workspaceId),
                this.invoices.issuedOrPaid(workspaceId),
                this.transactions.openCredits(workspaceId),
                this.workReads.newestFigures(workspaceId, WORK_LIMIT),
                this.executionFigures.countPendingWithoutWork(workspaceId),
                this.decisions.since(workspaceId, new Date(since7)),
                this.recent(workspaceId),
            ])
        const goals: OverviewAuthority | null =
            authority === null
                ? null
                : {
                      goalRevenueVnd: authority.goal_revenue_vnd,
                      goalNewCustomers: authority.goal_new_customers,
                      goalFirstReplyMinutes: authority.goal_first_reply_minutes,
                  }
        return {
            authority: goals,
            leads: leads.map((lead) => ({ ...lead, createdAt: instant(lead.createdAt) })),
            orders,
            invoices,
            transactions,
            work: work.map((item) => ({
                ...item,
                createdAt: instant(item.createdAt),
                updatedAt: instant(item.updatedAt),
                completedAt: optionalInstant(item.completedAt),
            })),
            pendingWithoutWork,
            decisions7: decisions7.map((decision) => ({ ...decision, createdAt: instant(decision.createdAt) })),
            recent,
        }
    }

    /** Whether an outcome was recorded for a customer who was won. */
    private async hasWon(workspaceId: string): Promise<boolean> {
        const won = await this.leadReads.idsAtStage(workspaceId, "won")
        return this.eventReads.existsOfKindForLeads(workspaceId, "outcome.recorded", won)
    }

    /** Whether an invoice-preparation step has an approved execution. */
    private async invoiceApproved(workspaceId: string): Promise<boolean> {
        const steps = await this.responsibilityReads.idsTitledLike(workspaceId, INVOICE_TITLES, INVOICE_STEP_LIMIT)
        return this.executionFigures.hasApprovedAmong(workspaceId, steps)
    }

    /** The newest decisions with the name of the lead each concerned, newest first. */
    private async recent(workspaceId: string): Promise<Array<OverviewDecision>> {
        const decisions = await this.decisions.recent(workspaceId, RECENT_DECISIONS)
        const names = await this.leadRecords.namesOf(
            workspaceId,
            decisions.flatMap((decision) => (decision.leadId === null ? [] : [decision.leadId])),
        )
        const nameOf = new Map(names.map((lead) => [lead.id, lead.contact_name]))
        return decisions.map((decision) => ({
            ...decision,
            leadName: decision.leadId === null ? null : (nameOf.get(decision.leadId) ?? null),
            createdAt: instant(decision.createdAt),
        }))
    }
}
