import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AgentConversationsAutomationReadService } from "@modules/domain/agent-conversations"
import { AgentMessagesAutomationReadService } from "@modules/domain/agent-messages"
import { ContractsReadService } from "@modules/domain/contracts"
import type { ContractFacts } from "@modules/domain/contracts"
import { EventsActivityReadService } from "@modules/domain/events"
import { InvoicesAutomationReadService } from "@modules/domain/invoices"
import { LeadAutomationReadService } from "@modules/domain/leads"
import { OrdersAutomationReadService } from "@modules/domain/orders"
import { WorkItemsActivityService } from "@modules/domain/work-items"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type {
    ConversationRead,
    DayFigures,
    DebtInvoice,
    LastCustomerMessage,
    LeadActivity,
    LeadRead,
    OrderRead,
    ScanLead,
    ScanLeadsQuery,
} from "./automation-reads.contracts"

/** The most leads one lookup of activity answers for. */
const LEADS_SCANNED = 500
/** The most leads with an outcome the day report counts the won ones among. */
const OUTCOME_LEADS_LIMIT = 500
/** The most contracts one scan reads. */
const CONTRACTS_SCANNED = 100
/** The most decisions the day report lists as waiting. */
const WAITING_LISTED = 50

@Injectable()
/**
 * The reads an automation makes of what other capabilities own (leads, conversations, events, orders, invoices, contracts, work
 * items). Each is one bounded call to the read service of the owner; none writes.
 */
export class AutomationReadsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly leads: LeadAutomationReadService,
        private readonly conversations: AgentConversationsAutomationReadService,
        private readonly messages: AgentMessagesAutomationReadService,
        private readonly events: EventsActivityReadService,
        private readonly orders: OrdersAutomationReadService,
        private readonly invoices: InvoicesAutomationReadService,
        private readonly contracts: ContractsReadService,
        private readonly work: WorkItemsActivityService,
    ) {}

    /** One lead of a workspace. */
    lead(workspaceId: string, leadId: string): Promise<LeadRead | undefined> {
        return this.leads.lead(workspaceId, leadId)
    }

    /** One conversation of a workspace. */
    conversation(workspaceId: string, conversationId: string): Promise<ConversationRead | undefined> {
        return this.conversations.conversation(workspaceId, conversationId)
    }

    /** The latest real conversation of a lead (website chat, Telegram...): where a message to the customer leaves. */
    latestConversation(workspaceId: string, leadId: string): Promise<ConversationRead | undefined> {
        return this.conversations.latestOfLead(workspaceId, leadId)
    }

    /** The leads created after an instant, newest first. */
    scanLeads(query: ScanLeadsQuery): Promise<Array<ScanLead>> {
        return this.leads.scanLeads(query)
    }

    /** The leads, among some, that have a real conversation; bounded by the ids. */
    leadsWithChat(workspaceId: string, leadIds: ReadonlyArray<string>): Promise<Array<{ lead_id: string }>> {
        return this.conversations.leadsWithChat(workspaceId, leadIds)
    }

    /** The instant of the last event of each lead; bounded by the ids. */
    leadActivity(workspaceId: string, leadIds: ReadonlyArray<string>): Promise<Array<LeadActivity>> {
        return this.events.lastAtByLead(workspaceId, leadIds, LEADS_SCANNED)
    }

    /** The figures of the day report from an instant on, read in one snapshot. */
    dayFigures(workspaceId: string, start: string): Promise<DayFigures> {
        return this.entityManager.transaction("REPEATABLE READ", async (tx) => {
            const newLeads = await this.leads.countCreatedSince(workspaceId, start, tx)
            const orders = await this.orders.confirmedSince(workspaceId, start, tx)
            const moneyIn = await this.invoices.paidTotalSince(workspaceId, start, tx)
            const outcomeLeads = await this.events.leadIdsOfKindSince(
                workspaceId,
                "outcome.recorded",
                new Date(start),
                OUTCOME_LEADS_LIMIT,
            )
            const won = await this.leads.countWonAmong(workspaceId, outcomeLeads, tx)
            const waiting = await this.work.waitingSummaries(workspaceId, WAITING_LISTED, tx)
            return {
                new_leads: newLeads,
                confirmed_orders: orders.count,
                confirmed_total: orders.total,
                money_in: moneyIn,
                won_leads: won,
                waiting,
            }
        })
    }

    /** The issued invoices due before an instant, oldest first; bounded. */
    debtInvoices(workspaceId: string, cutoff: string): Promise<Array<DebtInvoice>> {
        return this.invoices.debtInvoices(workspaceId, cutoff)
    }

    /** One order of a workspace. */
    order(workspaceId: string, orderId: string): Promise<OrderRead | undefined> {
        return this.orders.order(workspaceId, orderId)
    }

    /** One contract of a workspace. */
    contract(workspaceId: string, contractId: string): Promise<ContractFacts | undefined> {
        return this.contracts.contractById(workspaceId, contractId)
    }

    /** When the customer last wrote in a conversation, the start of the 48-hour window of Zalo. */
    lastCustomerMessage(conversationId: string): Promise<LastCustomerMessage | undefined> {
        return this.messages.lastCustomerMessage(conversationId)
    }

    /** The active contracts ending between two days, soonest first; bounded. */
    expiringContracts(workspaceId: string, firstDay: string, lastDay: string): Promise<Array<ContractFacts>> {
        return this.contracts.activeEndingBetween(workspaceId, firstDay, lastDay, CONTRACTS_SCANNED)
    }
}
