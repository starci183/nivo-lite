import { Injectable } from "@nestjs/common"
import type { EntityManager, SelectQueryBuilder } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { RawGovernance } from "./governance.policy"
import type {
    OverviewAuthority,
    OverviewDecision,
    OverviewFirstEvent,
    OverviewGovernanceInvoice,
    OverviewGovernanceLead,
    OverviewGovernanceOrder,
    OverviewGovernanceTransaction,
    OverviewPromo,
    OverviewPromoChatbot,
    OverviewWebsiteLead,
    OverviewWindow,
} from "./overview.contracts"
import { instant } from "./overview-reads.service"

/** How many leads the figures count. */
const LEAD_LIMIT = 10_000
/** How many work items the governance figures read. */
const WORK_LIMIT = 2000
/** How many recent decisions the governance block lists. */
const RECENT_DECISIONS = 40
/** The leads that came in through the website channel. */
const WEBSITE_LEAD = "l.workspace_id = :workspaceId AND l.channel ILIKE '%website%'"
/** The historical Vietnamese invoice title prefix used by existing responsibility rows. */
const INVOICE_TITLE = "Chuẩn bị hóa đơn%"

/** A read of one table of the workspace, the start of every figure. */
type Read = SelectQueryBuilder<object>

/** The decision rows of the governance block as the read answers them. */
type DecisionWindow = RawGovernance["decisions7"]

/** The work rows of the governance block as the read answers them. */
type WorkWindow = RawGovernance["work"]

@Injectable()
/** The composite figures of the executive dashboard: the onboarding facts and the governance rows, each read in one snapshot. */
export class OverviewFiguresService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The facts behind the onboarding checklist and the website lead stats. */
    promo(workspaceId: string, window: OverviewWindow): Promise<OverviewPromo> {
        return this.entityManager.transaction("REPEATABLE READ", async (manager) => {
            const of = (table: string, alias: string): Read =>
                manager
                    .createQueryBuilder()
                    .from(table, alias)
                    .where(`${alias}.workspace_id = :workspaceId`, { workspaceId })
            const chatbot = await of("public.agents", "a")
                .select("a.id", "id")
                .addSelect("a.knowledge", "knowledge")
                .andWhere("a.module = 'chatbot'")
                .orderBy("a.created_at")
                .limit(1)
                .getRawOne<OverviewPromoChatbot>()
            const isFoundingMember = await of("public.events", "e")
                .select("1")
                .andWhere("e.kind = 'module.purchased' AND e.created_at >= :foundingFrom::timestamptz")
                .andWhere("e.created_at <= :foundingTo::timestamptz")
                .setParameters({ foundingFrom: window.foundingFrom, foundingTo: window.foundingTo })
                .getExists()
            const websiteLeads = await of("public.leads", "l")
                .select("l.id", "id")
                .addSelect(instant("l.created_at"), "createdAt")
                .andWhere("l.channel ILIKE '%website%'")
                .getRawMany<OverviewWebsiteLead>()
            const websiteIds = manager
                .createQueryBuilder()
                .subQuery()
                .select("l.id")
                .from("public.leads", "l")
                .where(WEBSITE_LEAD)
                .getQuery()
            const firstEvents = await of("public.events", "e")
                .select("e.lead_id", "leadId")
                .addSelect(instant("min(e.created_at)"), "at")
                .andWhere(`e.kind IN ('execution.approved', 'responsibility.assigned') AND e.lead_id IN ${websiteIds}`)
                .groupBy("e.lead_id")
                .getRawMany<OverviewFirstEvent>()
            const hasCustomerConversation = await of("public.agent_conversations", "c")
                .select("1")
                .andWhere("c.kind = 'customer'")
                .getExists()
            const hasLeadConversation = await of("public.agent_conversations", "c")
                .select("1")
                .andWhere("c.lead_id IS NOT NULL")
                .getExists()
            const approved = await of("public.executions", "x")
                .select("count(*)::int", "count")
                .andWhere("x.status = 'approved'")
                .getRawOne<{ readonly count: number }>()
            const wonLeads = manager
                .createQueryBuilder()
                .subQuery()
                .select("w.id")
                .from("public.leads", "w")
                .where("w.workspace_id = :workspaceId AND w.stage = 'won'")
                .getQuery()
            const hasWon = await of("public.events", "e")
                .select("1")
                .andWhere(`e.kind = 'outcome.recorded' AND e.lead_id IN ${wonLeads}`)
                .getExists()
            const approvedSteps = manager
                .createQueryBuilder()
                .subQuery()
                .select("x.responsibility_id")
                .from("public.executions", "x")
                .where("x.workspace_id = :workspaceId AND x.status = 'approved'")
                .getQuery()
            const invoiceApproved = await of("public.responsibilities", "r")
                .select("1")
                .andWhere("(r.title ILIKE 'Prepare invoice%' OR r.title ILIKE :invoiceTitle)", {
                    invoiceTitle: INVOICE_TITLE,
                })
                .andWhere(`r.id IN ${approvedSteps}`)
                .getExists()
            return {
                chatbot: chatbot ?? null,
                isFoundingMember,
                websiteLeads,
                firstEvents,
                hasCustomerConversation,
                hasLeadConversation,
                approvedCount: approved?.count ?? 0,
                hasWon,
                invoiceApproved,
            }
        })
    }

    /** The rows behind the governance figures, read in one snapshot. */
    governance(workspaceId: string, since7: string): Promise<RawGovernance> {
        return this.entityManager.transaction("REPEATABLE READ", async (manager) => {
            const of = (table: string, alias: string): Read =>
                manager
                    .createQueryBuilder()
                    .from(table, alias)
                    .where(`${alias}.workspace_id = :workspaceId`, { workspaceId })
            const authority = await of("public.authority", "a")
                .select("a.goal_revenue_vnd::float8", "goalRevenueVnd")
                .addSelect("a.goal_new_customers", "goalNewCustomers")
                .addSelect("a.goal_first_reply_minutes", "goalFirstReplyMinutes")
                .getRawOne<OverviewAuthority>()
            const leads = await of("public.leads", "l")
                .select("l.id", "id")
                .addSelect("l.contact_name", "contactName")
                .addSelect("l.company", "company")
                .addSelect("l.stage", "stage")
                .addSelect(instant("l.created_at"), "createdAt")
                .limit(LEAD_LIMIT)
                .getRawMany<OverviewGovernanceLead>()
            const orders = await of("public.orders", "o")
                .select("o.id", "id")
                .addSelect("o.lead_id", "leadId")
                .addSelect("o.order_no", "orderNo")
                .addSelect("o.items", "items")
                .addSelect("o.amount_vnd::float8", "amountVnd")
                .addSelect("o.status", "status")
                .andWhere("o.status IN ('confirmed', 'invoiced', 'paid')")
                .getRawMany<OverviewGovernanceOrder>()
            const invoices = await of("public.invoices", "i")
                .select("i.id", "id")
                .addSelect("i.order_id", "orderId")
                .addSelect("i.lead_id", "leadId")
                .addSelect("i.invoice_no", "invoiceNo")
                .addSelect("i.amount_vnd::float8", "amountVnd")
                .addSelect("i.status", "status")
                .andWhere("i.status IN ('issued', 'paid')")
                .getRawMany<OverviewGovernanceInvoice>()
            const transactions = await of("public.transactions", "t")
                .select("t.id", "id")
                .addSelect("t.invoice_id", "invoiceId")
                .addSelect("t.payer", "payer")
                .addSelect("t.reference", "reference")
                .addSelect("t.amount_vnd::float8", "amountVnd")
                .addSelect("t.status", "status")
                .andWhere("t.direction = 'credit' AND t.status IN ('matched', 'unmatched', 'needs_review')")
                .getRawMany<OverviewGovernanceTransaction>()
            const work = await this.work(of("public.work_items", "w"))
            const pendingWithoutWork = await of("public.executions", "x")
                .select("count(*)::int", "count")
                .andWhere("x.status = 'pending_approval' AND x.work_item_id IS NULL")
                .getRawOne<{ readonly count: number }>()
            const decisions7 = await this.decisions7(of("public.decisions", "d"), since7)
            const recent = await this.recent(of("public.decisions", "d"), manager)
            return {
                authority: authority ?? null,
                leads,
                orders,
                invoices,
                transactions,
                work,
                pendingWithoutWork: pendingWithoutWork?.count ?? 0,
                decisions7,
                recent,
            }
        })
    }

    /** The newest work items, newest first. */
    private work(read: Read): Promise<WorkWindow> {
        return read
            .select("w.id", "id")
            .addSelect("w.lead_id", "leadId")
            .addSelect("w.department", "department")
            .addSelect("w.status", "status")
            .addSelect("w.reason", "reason")
            .addSelect("w.decided_path", "decidedPath")
            .addSelect(instant("w.created_at"), "createdAt")
            .addSelect(instant("w.updated_at"), "updatedAt")
            .addSelect(instant("w.completed_at"), "completedAt")
            .addSelect("w.proposal ->> 'summary'", "summary")
            .addSelect("w.proposal -> 'fields' ->> 'contact_name'", "contact")
            .addSelect("w.proposal -> 'fields' ->> 'customer'", "customer")
            .orderBy("w.created_at", "DESC")
            .limit(WORK_LIMIT)
            .getRawMany<WorkWindow[number]>()
    }

    /** The decisions since the start of the 7-day window. */
    private decisions7(read: Read, since7: string): Promise<DecisionWindow> {
        return read
            .select("d.work_item_id", "workItemId")
            .addSelect("d.lead_id", "leadId")
            .addSelect("d.decider_kind", "deciderKind")
            .addSelect("d.outcome", "outcome")
            .addSelect(instant("d.created_at"), "createdAt")
            .andWhere("d.created_at >= :since7::timestamptz", { since7 })
            .getRawMany<DecisionWindow[number]>()
    }

    /** The newest decisions with the name of the lead each concerned, newest first. */
    private recent(read: Read, manager: EntityManager): Promise<Array<OverviewDecision>> {
        const leadName = manager
            .createQueryBuilder()
            .subQuery()
            .select("l.contact_name")
            .from("public.leads", "l")
            .where("l.id = d.lead_id")
            .getQuery()
        return read
            .select("d.id", "id")
            .addSelect("d.work_item_id", "workItemId")
            .addSelect("d.lead_id", "leadId")
            .addSelect(leadName, "leadName")
            .addSelect("d.department", "department")
            .addSelect("d.action", "action")
            .addSelect("d.decided_by", "decidedBy")
            .addSelect("d.decider_kind", "deciderKind")
            .addSelect("d.outcome", "outcome")
            .addSelect("d.reason", "reason")
            .addSelect("d.note", "note")
            .addSelect(instant("d.created_at"), "createdAt")
            .orderBy("d.created_at", "DESC")
            .limit(RECENT_DECISIONS)
            .getRawMany<OverviewDecision>()
    }
}
