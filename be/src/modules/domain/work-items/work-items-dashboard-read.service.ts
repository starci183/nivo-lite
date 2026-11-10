import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type {
    AgentActionActivity,
    AgentResponseTime,
    AgentWaiting,
    DashboardRange,
    WaitingApprovals,
} from "./work-items-dashboard-read.contracts"
import { WorkItemEntity } from "./persistence/entities"

/** The most groups one dashboard read returns: agents times actions. */
const GROUP_LIMIT = 1000

/** The seconds an item took from raised to finished. */
const TOOK_SECONDS = "EXTRACT(EPOCH FROM (w.completed_at - w.created_at))"

/** Finished inside the period (named parameters `from` and `to`). */
const DONE_IN_PERIOD = "w.status = 'done' AND w.completed_at >= :from AND w.completed_at < :to"

/** Finished inside the period before (named parameters `previousFrom` and `from`). */
const DONE_IN_PREVIOUS = "w.status = 'done' AND w.completed_at >= :previousFrom AND w.completed_at < :from"

/** Failed inside the period (named parameters `from` and `to`). */
const FAILED_IN_PERIOD = "w.status = 'failed' AND w.updated_at >= :from AND w.updated_at < :to"

interface ActivityRow {
    readonly department: string
    readonly installation_id: string | null
    readonly action: string
    readonly done: number
    readonly auto_done: number
    readonly failed: number
    readonly previous_done: number
    readonly previous_auto_done: number
}

interface ResponseRow {
    readonly department: string
    readonly installation_id: string | null
    readonly median_seconds: number | null
}

interface WaitingRow {
    readonly department: string
    readonly installation_id: string | null
    readonly waiting: number
}

interface ApprovalRow {
    readonly id: string
    readonly department: string
    readonly installation_id: string | null
    readonly action: string
    readonly created_at: string
    readonly summary: string | null
    readonly customer: string | null
    readonly total: number
}

const paramsOf = (range: DashboardRange) => ({
    from: range.from,
    to: range.to,
    previousFrom: range.previousFrom,
})

@Injectable()
/**
 * The work item facts the workspace dashboard weighs, each in one grouped statement: what every agent finished, by policy or by a
 * person, the middle time it took, what waits for a decision now, and the oldest items that wait. The agent of an item is its
 * department and instance; the dashboard maps those to agents.
 */
export class WorkItemsDashboardReadService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Per department, instance and action: items finished and failed in the period, and finished in the period before. */
    async activityOf(workspaceId: string, range: DashboardRange): Promise<ReadonlyArray<AgentActionActivity>> {
        const rows = await this.entityManager
            .createQueryBuilder(WorkItemEntity, "w")
            .select("w.department", "department")
            .addSelect("w.installation_id", "installation_id")
            .addSelect("w.action", "action")
            .addSelect(`COUNT(*) FILTER (WHERE ${DONE_IN_PERIOD})::int`, "done")
            .addSelect(`COUNT(*) FILTER (WHERE ${DONE_IN_PERIOD} AND w.decided_path = 'auto')::int`, "auto_done")
            .addSelect(`COUNT(*) FILTER (WHERE ${FAILED_IN_PERIOD})::int`, "failed")
            .addSelect(`COUNT(*) FILTER (WHERE ${DONE_IN_PREVIOUS})::int`, "previous_done")
            .addSelect(
                `COUNT(*) FILTER (WHERE ${DONE_IN_PREVIOUS} AND w.decided_path = 'auto')::int`,
                "previous_auto_done",
            )
            .where("w.workspace_id = :workspaceId", { workspaceId })
            .andWhere(
                "((w.completed_at >= :previousFrom AND w.completed_at < :to) OR (w.updated_at >= :from AND w.updated_at < :to))",
            )
            .setParameters(paramsOf(range))
            .groupBy("w.department")
            .addGroupBy("w.installation_id")
            .addGroupBy("w.action")
            .limit(GROUP_LIMIT)
            .getRawMany<ActivityRow>()
        return rows.map((row) => ({
            department: row.department,
            installationId: row.installation_id,
            action: row.action,
            done: row.done,
            autoDone: row.auto_done,
            failed: row.failed,
            previousDone: row.previous_done,
            previousAutoDone: row.previous_auto_done,
        }))
    }

    /** Per department and instance: the median seconds to finish an item that policy alone decided, in the period. */
    async responseTimesOf(workspaceId: string, range: DashboardRange): Promise<ReadonlyArray<AgentResponseTime>> {
        const rows = await this.entityManager
            .createQueryBuilder(WorkItemEntity, "w")
            .select("w.department", "department")
            .addSelect("w.installation_id", "installation_id")
            .addSelect(`percentile_cont(0.5) WITHIN GROUP (ORDER BY ${TOOK_SECONDS})::float8`, "median_seconds")
            .where("w.workspace_id = :workspaceId", { workspaceId })
            .andWhere(DONE_IN_PERIOD)
            .andWhere("w.decided_path = 'auto'")
            .setParameters(paramsOf(range))
            .groupBy("w.department")
            .addGroupBy("w.installation_id")
            .limit(GROUP_LIMIT)
            .getRawMany<ResponseRow>()
        return rows.map((row) => ({
            department: row.department,
            installationId: row.installation_id,
            medianSeconds: row.median_seconds,
        }))
    }

    /** Per department and instance: the items that wait for a decision now. */
    async waitingOf(workspaceId: string): Promise<ReadonlyArray<AgentWaiting>> {
        const rows = await this.entityManager
            .createQueryBuilder(WorkItemEntity, "w")
            .select("w.department", "department")
            .addSelect("w.installation_id", "installation_id")
            .addSelect("COUNT(*)::int", "waiting")
            .where("w.workspace_id = :workspaceId AND w.status = 'waiting_decision'", { workspaceId })
            .groupBy("w.department")
            .addGroupBy("w.installation_id")
            .limit(GROUP_LIMIT)
            .getRawMany<WaitingRow>()
        return rows.map((row) => ({
            department: row.department,
            installationId: row.installation_id,
            waiting: row.waiting,
        }))
    }

    /** The items that wait for a decision, the oldest first, at most `limit`, with how many wait in all. */
    async waitingApprovalsOf(workspaceId: string, limit: number): Promise<WaitingApprovals> {
        const rows = await this.entityManager
            .createQueryBuilder(WorkItemEntity, "w")
            .select("w.id", "id")
            .addSelect("w.department", "department")
            .addSelect("w.installation_id", "installation_id")
            .addSelect("w.action", "action")
            .addSelect("to_json(w.created_at) #>> '{}'", "created_at")
            .addSelect("NULLIF(w.proposal->>'summary', '')", "summary")
            .addSelect("NULLIF(w.proposal->'fields'->>'customer', '')", "customer")
            .addSelect("COUNT(*) OVER()::int", "total")
            .where("w.workspace_id = :workspaceId AND w.status = 'waiting_decision'", { workspaceId })
            .orderBy("w.created_at", "ASC")
            .addOrderBy("w.id", "ASC")
            .limit(limit)
            .getRawMany<ApprovalRow>()
        return {
            total: rows[0]?.total ?? 0,
            items: rows.map((row) => ({
                id: row.id,
                department: row.department,
                installationId: row.installation_id,
                action: row.action,
                createdAt: row.created_at,
                summary: row.summary,
                customer: row.customer,
            })),
        }
    }
}
