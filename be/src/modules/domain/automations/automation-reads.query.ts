import { LeadEntity } from "@modules/domain/leads"
import { AgentConversationEntity } from "@modules/domain/agent-conversations"
import { EventEntity } from "@modules/domain/events"
import { OrderEntity } from "@modules/domain/orders"
import { InvoiceEntity } from "@modules/domain/invoices"
import type { WorkItemsActivityService } from "@modules/domain/work-items"
import { ContractEntity } from "@modules/domain/contracts"
import { AgentMessageEntity } from "@modules/domain/agent-messages"
import type { EntityManager } from "typeorm"
import type {
    ContractRead,
    ConversationRead,
    DayFigures,
    DebtInvoice,
    LastCustomerMessage,
    LeadActivity,
    LeadRead,
    OrderRead,
    ScanLead,
} from "./automation-reads.contracts"

/**
 * The reads an automation makes of the tables other capabilities own (leads, conversations, events, orders, invoices, contracts,
 * work items, staff). Each is one bounded statement over the table name, and none writes.
 */

/** One lead of a workspace. */
export const readLead = (manager: EntityManager, workspaceId: string, leadId: string): Promise<LeadRead | undefined> =>
    manager
        .createQueryBuilder(LeadEntity, "l")
        .select([
            "l.id AS id",
            "l.contact_name AS contact_name",
            "l.company AS company",
            "l.channel AS channel",
            "l.need AS need",
            "l.stage AS stage",
            "l.phone AS phone",
            "l.email AS email",
        ])
        .where("l.workspace_id = :workspaceId AND l.id = :leadId", { workspaceId, leadId })
        .limit(1)
        .getRawOne<LeadRead>()

const CONVERSATION_COLUMNS = [
    "c.id AS id",
    "c.channel AS channel",
    "c.handled_by AS handled_by",
    "c.visitor_name AS visitor_name",
    "c.lead_id AS lead_id",
]

/** One conversation of a workspace. */
export const readConversation = (
    manager: EntityManager,
    workspaceId: string,
    conversationId: string,
): Promise<ConversationRead | undefined> =>
    manager
        .createQueryBuilder(AgentConversationEntity, "c")
        .select(CONVERSATION_COLUMNS)
        .where("c.workspace_id = :workspaceId AND c.id = :conversationId", { workspaceId, conversationId })
        .limit(1)
        .getRawOne<ConversationRead>()

/** The latest real conversation of a lead (website chat, Telegram...): where a message to the customer leaves. */
export const readLatestConversation = (
    manager: EntityManager,
    workspaceId: string,
    leadId: string,
): Promise<ConversationRead | undefined> =>
    manager
        .createQueryBuilder(AgentConversationEntity, "c")
        .select(CONVERSATION_COLUMNS)
        .where("c.workspace_id = :workspaceId AND c.lead_id = :leadId AND c.kind = 'customer'", { workspaceId, leadId })
        .orderBy("c.created_at", "DESC")
        .limit(1)
        .getRawOne<ConversationRead>()

/** What the scan of leads is asked: the leads created after an instant, in some stages or in every stage but one. */
export interface ScanLeadsQuery {
    /** The workspace. */
    readonly workspaceId: string
    /** The instant the leads were created after, ISO. */
    readonly since: string
    /** The stages to read, or null for every stage. */
    readonly stages: ReadonlyArray<string> | null
    /** The stage to leave out, or null. */
    readonly except: string | null
    /** The most leads read. */
    readonly limit: number
}

/** The leads created after an instant, newest first. */
export const readScanLeads = (manager: EntityManager, query: ScanLeadsQuery): Promise<Array<ScanLead>> => {
    const leads = manager
        .createQueryBuilder(LeadEntity, "l")
        .select(["l.id AS id", "l.stage AS stage", "l.created_at AS created_at"])
        .where("l.workspace_id = :workspaceId AND l.created_at >= :since", {
            workspaceId: query.workspaceId,
            since: query.since,
        })
    if (query.stages !== null) leads.andWhere("l.stage = ANY(:stages)", { stages: query.stages })
    if (query.except !== null) leads.andWhere("l.stage <> :except", { except: query.except })
    return leads.orderBy("l.created_at", "DESC").limit(query.limit).getRawMany<ScanLead>()
}

/** The leads, among some, that have a real conversation; bounded by the ids. */
export const readLeadsWithChat = (
    manager: EntityManager,
    workspaceId: string,
    leadIds: ReadonlyArray<string>,
): Promise<Array<{ lead_id: string }>> =>
    manager
        .createQueryBuilder(AgentConversationEntity, "c")
        .select("DISTINCT c.lead_id", "lead_id")
        .where("c.workspace_id = :workspaceId AND c.kind = 'customer' AND c.lead_id = ANY(:leadIds::uuid[])", {
            workspaceId,
            leadIds,
        })
        .limit(500)
        .getRawMany<{ lead_id: string }>()

/** The instant of the last event of each lead; bounded by the ids. */
export const readLeadActivity = (
    manager: EntityManager,
    workspaceId: string,
    leadIds: ReadonlyArray<string>,
): Promise<Array<LeadActivity>> =>
    manager
        .createQueryBuilder(EventEntity, "e")
        .select("e.lead_id", "lead_id")
        .addSelect("max(e.created_at)", "last_at")
        .where("e.workspace_id = :workspaceId AND e.lead_id = ANY(:leadIds::uuid[])", { workspaceId, leadIds })
        .groupBy("e.lead_id")
        .limit(500)
        .getRawMany<LeadActivity>()

/** The figures of the day report from an instant on, read in one snapshot. */
export const readDayFigures = (
    manager: EntityManager,
    work: WorkItemsActivityService,
    workspaceId: string,
    start: string,
): Promise<DayFigures> =>
    manager.transaction("REPEATABLE READ", async (tx) => {
        const from = { workspaceId, start }
        const newLeads = await tx
            .createQueryBuilder(LeadEntity, "l")
            .select("count(*)::int", "count")
            .where("l.workspace_id = :workspaceId AND l.created_at >= :start", from)
            .getRawOne<{ count: number }>()
        const orders = await tx
            .createQueryBuilder(OrderEntity, "o")
            .select("count(*)::int", "count")
            .addSelect("coalesce(sum(o.amount_vnd), 0)::bigint", "total")
            .where("o.workspace_id = :workspaceId AND o.confirmed_at >= :start AND o.status <> 'cancelled'", from)
            .getRawOne<{ count: number; total: string | number }>()
        const moneyIn = await tx
            .createQueryBuilder(InvoiceEntity, "i")
            .select("coalesce(sum(i.amount_vnd), 0)::bigint", "total")
            .where("i.workspace_id = :workspaceId AND i.status = 'paid' AND i.paid_at >= :start", from)
            .getRawOne<{ total: string | number }>()
        const won = await tx
            .createQueryBuilder(LeadEntity, "l")
            .select("count(*)::int", "count")
            .where("l.workspace_id = :workspaceId AND l.stage = 'won'", from)
            .andWhere(
                (outer) =>
                    `l.id IN ${outer
                        .subQuery()
                        .select("DISTINCT e.lead_id")
                        .from(EventEntity, "e")
                        .where(
                            "e.workspace_id = :workspaceId AND e.kind = 'outcome.recorded' AND e.created_at >= :start AND e.lead_id IS NOT NULL",
                        )
                        .getQuery()}`,
            )
            .getRawOne<{ count: number }>()
        const waiting = await work.waitingSummaries(workspaceId, 50, tx)
        return {
            new_leads: newLeads?.count ?? 0,
            confirmed_orders: orders?.count ?? 0,
            confirmed_total: orders?.total ?? 0,
            money_in: moneyIn?.total ?? 0,
            won_leads: won?.count ?? 0,
            waiting,
        }
    })

/** The issued invoices due before an instant, oldest first; bounded. */
export const readDebtInvoices = (
    manager: EntityManager,
    workspaceId: string,
    cutoff: string,
): Promise<Array<DebtInvoice>> =>
    manager
        .createQueryBuilder(InvoiceEntity, "i")
        .select([
            "i.id AS id",
            "i.invoice_no AS invoice_no",
            "i.amount_vnd AS amount_vnd",
            "i.lead_id AS lead_id",
            "i.due_at AS due_at",
        ])
        .where(
            "i.workspace_id = :workspaceId AND i.status = 'issued' AND i.due_at IS NOT NULL AND i.due_at < :cutoff",
            {
                workspaceId,
                cutoff,
            },
        )
        .orderBy("i.due_at", "ASC")
        .limit(50)
        .getRawMany<DebtInvoice>()

/** One order of a workspace. */
export const readOrder = (
    manager: EntityManager,
    workspaceId: string,
    orderId: string,
): Promise<OrderRead | undefined> =>
    manager
        .createQueryBuilder(OrderEntity, "o")
        .select([
            "o.id AS id",
            "o.order_no AS order_no",
            "o.lead_id AS lead_id",
            "o.shipped_at AS shipped_at",
            "o.carrier AS carrier",
            "o.tracking_code AS tracking_code",
        ])
        .where("o.workspace_id = :workspaceId AND o.id = :orderId", { workspaceId, orderId })
        .limit(1)
        .getRawOne<OrderRead>()

/** One contract of a workspace. */
export const readContract = (
    manager: EntityManager,
    workspaceId: string,
    contractId: string,
): Promise<ContractRead | undefined> =>
    manager
        .createQueryBuilder(ContractEntity, "c")
        .select([
            "c.id AS id",
            "c.customer_name AS customer_name",
            "c.lead_id AS lead_id",
            "c.plan AS plan",
            "c.ends_on::text AS ends_on",
            "c.amount_vnd::float8 AS amount_vnd",
            "c.status AS status",
        ])
        .where("c.workspace_id = :workspaceId AND c.id = :contractId", { workspaceId, contractId })
        .limit(1)
        .getRawOne<ContractRead>()

/** When the customer last wrote in a conversation, the start of the 48-hour window of Zalo. */
export const readLastCustomerMessage = (
    manager: EntityManager,
    conversationId: string,
): Promise<LastCustomerMessage | undefined> =>
    manager
        .createQueryBuilder(AgentMessageEntity, "m")
        .select("m.created_at", "created_at")
        .where("m.conversation_id = :conversationId AND m.role = 'user'", { conversationId })
        .orderBy("m.created_at", "DESC")
        .limit(1)
        .getRawOne<LastCustomerMessage>()

/** The active contracts ending between two days, soonest first; bounded. */
export const readExpiringContracts = (
    manager: EntityManager,
    workspaceId: string,
    firstDay: string,
    lastDay: string,
): Promise<Array<{ id: string; ends_on: string }>> =>
    manager
        .createQueryBuilder(ContractEntity, "c")
        .select(["c.id AS id", "c.ends_on::text AS ends_on"])
        .where(
            "c.workspace_id = :workspaceId AND c.status = 'active' AND c.ends_on >= :firstDay AND c.ends_on <= :lastDay",
            {
                workspaceId,
                firstDay,
                lastDay,
            },
        )
        .orderBy("c.ends_on", "ASC")
        .limit(100)
        .getRawMany<{ id: string; ends_on: string }>()
