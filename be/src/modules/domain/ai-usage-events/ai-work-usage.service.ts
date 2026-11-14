import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { AiUsageEventEntity } from "./persistence/entities"
import {
    byRef,
    toAgentStepUsage,
    toWorkKindUsage,
    type AgentStepAggregate,
    type WorkKindAggregate,
} from "./work-usage.mapper"
import type { AgentStepUsage, WorkKindUsage } from "./work-usage.contracts"

/** An answered call (a failed try is counted apart and never summed as an answer). */
const ANSWERED = "u.failure IS NULL"
/** A failed try. */
const FAILED = "u.failure IS NOT NULL"

/** The most steps one agent's graph read returns: a graph has a few dozen nodes. */
const STEP_LIMIT = 200
/** The most records one read takes at once (a page of documents, the lessons of one card). */
export const WORK_REF_LIMIT = 100

/** The answered and failed figures every work read sums, as SQL expression and alias. */
const WORK_SUMS: ReadonlyArray<readonly [string, string]> = [
    [`(COUNT(*) FILTER (WHERE ${ANSWERED}))::int`, "calls"],
    [`(COUNT(*) FILTER (WHERE ${FAILED}))::int`, "failed_tries"],
    [`COALESCE(SUM(u.prompt_tokens + u.completion_tokens) FILTER (WHERE ${ANSWERED}), 0)::float8`, "tokens"],
    [`COALESCE(SUM(u.cost_usd) FILTER (WHERE ${ANSWERED}), 0)::float8`, "cost_usd"],
    [`COALESCE(SUM(u.cost_usd) FILTER (WHERE ${FAILED}), 0)::float8`, "failed_cost_usd"],
]

@Injectable()
/**
 * The model use of the work a workspace's AI did, read for the owner and managers: per step of an agent's graph and per record (a
 * document, a lesson). Every figure is exact: credits are fractions of the exact cost, never rounded per call. The guide counts in the
 * record reads (a learning card shows what its proposal cost NIVO).
 */
export class AiWorkUsageService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /**
     * The calls of one agent since an instant, per step of its graph, in ONE grouped statement for the whole graph: runs, answers,
     * failed tries, exact cost and credits, credits per run, the average time of an answer and the models that served. Served by
     * `ai_usage_events_agent_time` (workspace, agent, time).
     */
    async agentSteps(workspaceId: string, agentId: string, since: Date): Promise<ReadonlyArray<AgentStepUsage>> {
        const rows = await this.entityManager
            .createQueryBuilder(AiUsageEventEntity, "u")
            .select("u.step_key", "step_key")
            .addSelect("COUNT(DISTINCT u.run_id)::int", "runs")
            .addSelect(`(COUNT(*) FILTER (WHERE ${ANSWERED}))::int`, "calls")
            .addSelect(`(COUNT(*) FILTER (WHERE ${FAILED}))::int`, "failed_tries")
            .addSelect(`COALESCE(SUM(u.cost_usd) FILTER (WHERE ${ANSWERED}), 0)::float8`, "cost_usd")
            .addSelect(`COALESCE(SUM(u.cost_usd) FILTER (WHERE ${FAILED}), 0)::float8`, "failed_cost_usd")
            .addSelect(`(AVG(u.duration_ms) FILTER (WHERE ${ANSWERED}))::float8`, "average_ms")
            .addSelect(`array_agg(DISTINCT u.model) FILTER (WHERE ${ANSWERED})`, "models")
            .where("u.workspace_id = :workspaceId AND u.agent_id = :agentId", { workspaceId, agentId })
            .andWhere("u.created_at >= :since", { since })
            .andWhere("u.step_key IS NOT NULL")
            .groupBy("u.step_key")
            .orderBy("u.step_key", "ASC")
            .limit(STEP_LIMIT)
            .getRawMany<AgentStepAggregate>()
        return rows.map((item) => toAgentStepUsage(item))
    }

    /**
     * The calls made for the records given (`source:<id>`, `lesson:<id>`), per record and kind of work, in one grouped statement;
     * a record with no call is absent. Served by `ai_usage_events_work_ref` (workspace, record).
     */
    async byRefs(
        workspaceId: string,
        refs: ReadonlyArray<string>,
    ): Promise<ReadonlyMap<string, ReadonlyArray<WorkKindUsage>>> {
        const wanted = [...new Set(refs)].slice(0, WORK_REF_LIMIT)
        if (wanted.length === 0) return new Map()
        const grouped = WORK_SUMS.reduce(
            (query, [expression, alias]) => query.addSelect(expression, alias),
            this.entityManager
                .createQueryBuilder(AiUsageEventEntity, "u")
                .select("u.work_ref", "work_ref")
                .addSelect("COALESCE(u.work_kind, u.kind)", "work_kind"),
        )
        const rows = await grouped
            .addSelect(`array_agg(DISTINCT u.model) FILTER (WHERE ${ANSWERED})`, "models")
            .where("u.workspace_id = :workspaceId AND u.work_ref IN (:...refs)", { workspaceId, refs: wanted })
            .groupBy("1")
            .addGroupBy("2")
            .orderBy("1", "ASC")
            .addOrderBy("2", "ASC")
            .limit(wanted.length * 10)
            .getRawMany<WorkKindAggregate>()
        return byRef(rows.map((item) => toWorkKindUsage(item)))
    }
}
