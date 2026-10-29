import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AgentConversationEntity } from "@modules/domain/agent-conversations"
import { AgentMessageEntity } from "@modules/domain/agent-messages"
import { LeadEntity } from "@modules/domain/leads"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type {
    AnswerProgressLine,
    DashboardListLine,
    DashboardListQuery,
    RecentWorkLine,
    WaitingReplyRow,
} from "./work-items-activity.contracts"
import { WorkItemEntity } from "./persistence/entities"

/** What the lists call the customer: the lead's name, else the one the proposal carries. */
const CUSTOMER = "COALESCE(l.contact_name, w.proposal->'fields'->>'customer')"

/** The text a test run shows itself in. */
const TEST_RUN_TEXT =
    "concat_ws(' ', l.contact_name, l.company, w.proposal->>'summary', w.proposal->'fields'->>'contact_name', w.proposal->'fields'->>'customer')"

/** The moment a finished item stopped moving. */
const SETTLED_AT = "COALESCE(w.completed_at, w.updated_at)"

/** The summary a finished item records, else the one its proposal carried. */
const RESULT_SUMMARY = "COALESCE(NULLIF(w.result->>'summary', ''), w.proposal->>'summary')"

@Injectable()
/** The work item lists other capabilities show beside their own data: recent work, dashboard lists and the state of a customer reply. */
export class WorkItemsActivityService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The department's work most recently touched, newest first, with the lead's name folded in. */
    recentOf(workspaceId: string, department: string, limit: number): Promise<Array<RecentWorkLine>> {
        return this.entityManager
            .createQueryBuilder(WorkItemEntity, "w")
            .select("w.id", "id")
            .addSelect("w.action", "action")
            .addSelect("w.status", "status")
            .addSelect(`to_json(${SETTLED_AT}) #>> '{}'`, "at")
            .addSelect(RESULT_SUMMARY, "summary")
            .addSelect(CUSTOMER, "customer")
            .addSelect("w.leadId", "leadId")
            .leftJoin(LeadEntity, "l", "l.id = w.lead_id")
            .where("w.workspaceId = :workspaceId AND w.department = :department", { workspaceId, department })
            .orderBy(SETTLED_AT, "DESC")
            .addOrderBy("w.id", "ASC")
            .limit(limit)
            .getRawMany<RecentWorkLine>()
    }

    /**
     * One dashboard list of a department: test runs left out, the lead's name folded in and the total before the limit on every
     * row; a multi-instance type narrows to its own instance.
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
            .addSelect(CUSTOMER, "customer")
            .addSelect(waiting ? "NULL::text" : "w.result->>'href'", "resultHref")
            .addSelect("count(*) OVER ()", "total")
            .leftJoin(LeadEntity, "l", "l.id = w.lead_id")
            .where("w.workspaceId = :workspaceId AND w.department = :department", {
                workspaceId: query.workspaceId,
                department: query.department,
            })
            .andWhere(`NOT (${TEST_RUN_TEXT} ~ :pattern)`, { pattern: query.testRunPattern })
        if (query.installationId !== null) {
            items.andWhere("w.installationId = :scopeId", { scopeId: query.installationId })
        }
        const listed = waiting
            ? items
                  .andWhere("w.status = 'waiting_decision'")
                  .orderBy("w.createdAt", "ASC")
                  .addOrderBy("w.id", "ASC")
            : items
                  .andWhere("w.status = 'done' AND w.decidedPath = 'auto' AND w.completedAt >= :since", {
                      since: query.since,
                  })
                  .orderBy("w.completedAt", "DESC")
                  .addOrderBy("w.id", "ASC")
        return listed.limit(query.limit).getRawMany<DashboardListLine>()
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

    /** How far a customer-reply work item got, with the stored answer's delivery; null when the workspace has no such item. */
    async answerProgress(workspaceId: string, workItemId: string): Promise<AnswerProgressLine | null> {
        const row = await this.entityManager
            .createQueryBuilder(WorkItemEntity, "w")
            .select("w.id", "id")
            .addSelect("w.status", "work_status")
            .addSelect("m.id", "message_id")
            .addSelect("m.delivery_status", "delivery_status")
            .innerJoin(
                AgentConversationEntity,
                "c",
                "c.id::text = COALESCE(NULLIF(w.proposal -> 'fields' ->> 'conversation_id', ''), CASE WHEN w.subject_type = 'conversation' THEN w.subject_id::text ELSE NULL END) AND c.workspace_id = w.workspace_id AND c.kind = 'customer'",
            )
            .leftJoin(
                AgentMessageEntity,
                "m",
                "m.id = w.id AND m.workspace_id = w.workspace_id AND m.conversation_id = c.id AND m.author_kind = 'human'",
            )
            .where("w.workspace_id = :workspaceId AND w.id = :workItemId AND w.action = 'reply_customer'", {
                workspaceId,
                workItemId,
            })
            .limit(1)
            .getRawOne<AnswerProgressLine>()
        return row ?? null
    }
}
