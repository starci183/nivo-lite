import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { LeadReadService } from "@modules/domain/leads"
import type { LeadCard } from "@modules/domain/leads"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type {
    CareWorkItemId,
    DashboardListLine,
    DashboardListQuery,
    RecentWorkLine,
    WaitingReplyRow,
    WaitingSummary,
} from "./work-items-activity.contracts"
import { WorkItemEntity } from "./persistence/entities"

/** The moment a finished item stopped moving. */
const SETTLED_AT = "COALESCE(w.completed_at, w.updated_at)"

/** The summary a finished item records, else the one its proposal carried. */
const RESULT_SUMMARY = "COALESCE(NULLIF(w.result->>'summary', ''), w.proposal->>'summary')"

/** The most items one dashboard list weighs before test runs are left out and the limit is applied. */
const CANDIDATE_LIMIT = 500

/** An item as read before the lead's name is folded in. */
interface BareLine {
    readonly id: string
    readonly action: string
    readonly status?: RecentWorkLine["status"]
    readonly leadId: string | null
    readonly at: string
    readonly summary: string | null
    readonly resultHref?: string | null
    readonly proposalSummary?: string | null
    readonly proposalContact: string | null
    readonly proposalCustomer: string | null
}

/** What the lists call the customer: the lead's name, else the one the proposal carries. */
const customerOf = (row: BareLine, cards: ReadonlyMap<string, LeadCard>): string | null => {
    const card = row.leadId === null ? undefined : cards.get(row.leadId)
    return card === undefined ? row.proposalCustomer : card.contactName
}

@Injectable()
/** The work item lists other capabilities show beside their own data: recent work, dashboard lists and the state of a customer reply. */
export class WorkItemsActivityService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly leads: LeadReadService,
    ) {}

    /** The department's work most recently touched, newest first, with the lead's name folded in. */
    async recentOf(workspaceId: string, department: string, limit: number): Promise<Array<RecentWorkLine>> {
        const rows = await this.entityManager
            .createQueryBuilder(WorkItemEntity, "w")
            .select("w.id", "id")
            .addSelect("w.action", "action")
            .addSelect("w.status", "status")
            .addSelect(`to_json(${SETTLED_AT}) #>> '{}'`, "at")
            .addSelect(RESULT_SUMMARY, "summary")
            .addSelect("w.proposal->'fields'->>'customer'", "proposalCustomer")
            .addSelect("w.proposal->'fields'->>'contact_name'", "proposalContact")
            .addSelect("w.leadId", "leadId")
            .where("w.workspaceId = :workspaceId AND w.department = :department", { workspaceId, department })
            .orderBy(SETTLED_AT, "DESC")
            .addOrderBy("w.id", "ASC")
            .limit(limit)
            .getRawMany<BareLine>()
        const names = await this.leadCards(workspaceId, rows)
        return rows.map((row) => ({
            id: row.id,
            action: row.action,
            status: row.status ?? "queued",
            at: row.at,
            summary: row.summary,
            customer: customerOf(row, names),
            leadId: row.leadId,
        }))
    }

    /**
     * One dashboard list of a department: test runs left out, the lead's name folded in and the total before the limit on every
     * line; a multi-instance type narrows to its own instance. The lists weigh the newest items only (a bounded candidate set).
     */
    async dashboardList(query: DashboardListQuery): Promise<Array<DashboardListLine>> {
        const waiting = query.kind === "waiting"
        const items = this.entityManager
            .createQueryBuilder(WorkItemEntity, "w")
            .select("w.id", "id")
            .addSelect("w.action", "action")
            .addSelect("w.leadId", "leadId")
            .addSelect(`to_json(${waiting ? "w.created_at" : SETTLED_AT}) #>> '{}'`, "at")
            .addSelect(waiting ? "w.proposal->>'summary'" : RESULT_SUMMARY, "summary")
            .addSelect("w.proposal->>'summary'", "proposalSummary")
            .addSelect("w.proposal->'fields'->>'contact_name'", "proposalContact")
            .addSelect("w.proposal->'fields'->>'customer'", "proposalCustomer")
            .addSelect(waiting ? "NULL::text" : "w.result->>'href'", "resultHref")
            .where("w.workspaceId = :workspaceId AND w.department = :department", {
                workspaceId: query.workspaceId,
                department: query.department,
            })
        if (query.installationId !== null) {
            items.andWhere("w.installationId = :scopeId", { scopeId: query.installationId })
        }
        const listed = waiting
            ? items.andWhere("w.status = 'waiting_decision'").orderBy("w.createdAt", "ASC").addOrderBy("w.id", "ASC")
            : items
                  .andWhere("w.status = 'done' AND w.decidedPath = 'auto' AND w.completedAt >= :since", {
                      since: query.since,
                  })
                  .orderBy("w.completedAt", "DESC")
                  .addOrderBy("w.id", "ASC")
        const rows = await listed.limit(CANDIDATE_LIMIT).getRawMany<BareLine>()
        const cards = await this.leadCards(query.workspaceId, rows)
        const testRun = new RegExp(query.testRunPattern)
        const kept = rows.filter((row) => {
            const card = row.leadId === null ? undefined : cards.get(row.leadId)
            const text = [
                card?.contactName,
                card?.company,
                row.proposalSummary,
                row.proposalContact,
                row.proposalCustomer,
            ]
                .filter((part): part is string => part !== undefined && part !== null)
                .join(" ")
            return !testRun.test(text)
        })
        return kept.slice(0, query.limit).map((row) => ({
            id: row.id,
            action: row.action,
            leadId: row.leadId,
            at: row.at,
            summary: row.summary,
            customer: customerOf(row, cards),
            resultHref: row.resultHref ?? null,
            total: String(kept.length),
        }))
    }

    /** The customer-reply work items waiting for a decision, oldest first, at most `limit`. */
    waitingReplies(workspaceId: string, limit: number): Promise<Array<WaitingReplyRow>> {
        return this.entityManager
            .createQueryBuilder(WorkItemEntity, "w")
            .select("w.id", "id")
            .addSelect("w.subject_id", "subject_id")
            .addSelect("w.proposal", "proposal")
            .addSelect("w.assigned_staff_id", "assigned_staff_id")
            .addSelect("w.created_at", "created_at")
            .where("w.workspace_id = :workspaceId AND w.action = 'reply_customer' AND w.status = 'waiting_decision'", {
                workspaceId,
            })
            .orderBy("w.created_at")
            .limit(limit)
            .getRawMany<WaitingReplyRow>()
    }

    /** The one-line summaries of the items waiting for a decision, oldest first, at most `limit`. */
    async waitingSummaries(
        workspaceId: string,
        limit: number,
        manager: EntityManager = this.entityManager,
    ): Promise<Array<WaitingSummary>> {
        const rows = await manager
            .createQueryBuilder(WorkItemEntity, "w")
            .select("w.proposal ->> 'summary'", "summary")
            .where("w.workspace_id = :workspaceId AND w.status = 'waiting_decision'", { workspaceId })
            .orderBy("w.created_at", "ASC")
            .limit(limit)
            .getRawMany<{ summary: WaitingSummary }>()
        return rows.map((row) => row.summary)
    }

    /** The work item of the built-in care message the gate sent, or still holds, for the lead since an instant; null when none. */
    async builtInCareOf(
        workspaceId: string,
        leadId: string,
        since: string,
        manager: EntityManager = this.entityManager,
    ): Promise<CareWorkItemId> {
        const row = await manager
            .createQueryBuilder(WorkItemEntity, "w")
            .select("w.id", "id")
            .where("w.workspace_id = :workspaceId AND w.lead_id = :leadId AND w.action = 'send_care'", {
                workspaceId,
                leadId,
            })
            .andWhere(
                "w.status IN ('done', 'waiting_decision') AND w.dedupe_key LIKE 'send_care:%' AND w.created_at >= :since",
                { since },
            )
            .limit(1)
            .getRawOne<{ id: string }>()
        return row?.id ?? null
    }

    /** The cards of the leads the rows name, by lead id. */
    private async leadCards(workspaceId: string, rows: ReadonlyArray<BareLine>): Promise<Map<string, LeadCard>> {
        const ids = rows.flatMap((row) => (row.leadId === null ? [] : [row.leadId]))
        const cards = await this.leads.cardsOf(workspaceId, ids)
        return new Map(cards.map((card) => [card.id, card]))
    }
}
