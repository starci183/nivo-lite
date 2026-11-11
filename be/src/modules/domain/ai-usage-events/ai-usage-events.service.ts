import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { callDbFunction, InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger, runInScope, workInScope } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { noticeBody, noticeLevelOf } from "./notice.policy"
import { AiUsageEventEntity } from "./persistence/entities"
import { quotaFiguresOf, quotaLookupOf, quotaOf, stopsCall } from "./quota.policy"
import type {
    QuotaLookup,
    QuotaRecord,
    QuotaStatus,
    RunCallKindUsage,
    UsageInput,
    UsageKind,
    UsageSummary,
} from "./ai-usage-events.contracts"
import { AiUsageEventsLogEvent } from "./ai-usage-events.log-events"
import { callColumnsOf } from "./call-facts.policy"
import { workColumnsOf } from "./work-columns.policy"
import { toRunCallKind } from "./run-calls.mapper"
import type { RunCallKindAggregate } from "./run-calls.mapper"
import { CREDIT_USD_VALUE, figuresOf } from "./usage-cost.policy"
import { toDailyModuleUsage, toUsageSummary } from "./usage-summary.mapper"
import type { MonthlyUsageAggregate } from "./usage-summary.mapper"

/** The most day-and-module rollups the billing card reads. */
const MONTHLY_ROW_LIMIT = 2000

/** The most module rollups one period read returns. */
const MODULE_ROW_LIMIT = 200

/** The most call kinds one run's read returns: a run calls a handful of nodes. */
const RUN_KIND_LIMIT = 100

/** Rows of an answered call (a failed try is booked for the run page, never summed as an answer or billed). */
const ANSWERED = "u.failure IS NULL"
/** Rows of a failed try. */
const FAILED = "u.failure IS NOT NULL"

/** The figures of a run's calls summed per step and call kind, as SQL expression and alias (the columns of `RunCallKindAggregate`). */
const RUN_KIND_SUMS: ReadonlyArray<readonly [string, string]> = [
    [`(COUNT(*) FILTER (WHERE ${ANSWERED}))::int`, "calls"],
    ["COUNT(*)::int", "tries"],
    [`(COUNT(*) FILTER (WHERE ${FAILED}))::int`, "failed_tries"],
    ["MAX(u.try_number)::int", "max_try"],
    [`COALESCE(SUM(u.prompt_tokens) FILTER (WHERE ${ANSWERED}), 0)::float8`, "prompt_tokens"],
    [`COALESCE(SUM(u.cached_tokens) FILTER (WHERE ${ANSWERED}), 0)::float8`, "cached_tokens"],
    [`COALESCE(SUM(u.cache_write_tokens) FILTER (WHERE ${ANSWERED}), 0)::float8`, "cache_write_tokens"],
    [`COALESCE(SUM(u.completion_tokens) FILTER (WHERE ${ANSWERED}), 0)::float8`, "completion_tokens"],
    [`COALESCE(SUM(u.reasoning_tokens) FILTER (WHERE ${ANSWERED}), 0)::float8`, "reasoning_tokens"],
    [`COALESCE(SUM(u.prompt_tokens) FILTER (WHERE ${FAILED}), 0)::float8`, "failed_prompt_tokens"],
    ["COALESCE(SUM(u.duration_ms), 0)::float8", "duration_ms"],
    ["MAX(u.duration_ms)::float8", "slowest_ms"],
    [`COALESCE(SUM(u.cost_usd) FILTER (WHERE ${ANSWERED}), 0)::float8`, "cost_usd"],
    [`COALESCE(SUM(u.cost_usd) FILTER (WHERE ${FAILED}), 0)::float8`, "failed_cost_usd"],
    ["array_agg(DISTINCT u.upstream)", "upstreams"],
    ["array_agg(DISTINCT u.finish_reason)", "finish_reasons"],
    ["array_agg(DISTINCT u.model)", "models"],
    ["array_agg(DISTINCT u.declared_model)", "declared_models"],
    ["array_agg(DISTINCT u.model_provider)", "model_providers"],
    ["array_agg(DISTINCT u.model_reason)", "model_reasons"],
    ["array_agg(DISTINCT u.failure)", "failures"],
    ["array_agg(DISTINCT u.work_kind)", "work_kinds"],
]

@Injectable()
/** Meters every model call of a workspace and answers where the month stands against the allowance; the only writer of ai_usage_events. */
export class AiUsageEventsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /**
     * Books one model call. Never throws: metering must not break a reply. After the write the month's level is checked and the
     * owner is told once at 80% and once at 100%.
     */
    async record(input: UsageInput): Promise<void> {
        try {
            // A failed try is an estimate whatever usage it carries (the app counted its prompt, the provider answered nothing), unless
            // the provider reported it (a try cut at the token limit: the output it produced and bills).
            const priced = figuresOf(input, input.usage)
            const exact = input.failure === undefined || input.reported === true
            const figures = exact ? priced : { ...priced, cachedTokens: 0, estimated: true }
            await this.entityManager.insert(AiUsageEventEntity, {
                workspaceId: input.workspaceId,
                kind: input.kind,
                module: input.module,
                model: input.model.slice(0, 120),
                promptTokens: figures.promptTokens,
                completionTokens: figures.completionTokens,
                cachedTokens: figures.cachedTokens,
                costUsd: String(figures.costUsd),
                estimated: figures.estimated,
                runId: input.runId ?? runInScope(),
                ...callColumnsOf(input.call, figures),
                ...workColumnsOf(input.work ?? workInScope(), input.usage, figures, input.failure),
            })
            const status = await this.quotaStatus(input.workspaceId)
            if (status !== null) await this.notifyOwner(input.workspaceId, status)
        } catch (cause) {
            this.logger.error(AiUsageEventsLogEvent.RecordFailed, cause, { workspaceId: input.workspaceId })
        }
    }

    /** This month's use against the allowance, or null when it cannot be read (metering then fails open). */
    async quotaStatus(workspaceId: string): Promise<QuotaLookup> {
        try {
            const [record] = await this.quotaRecords(workspaceId)
            return record === undefined ? null : quotaOf(quotaFiguresOf(record))
        } catch (cause) {
            this.logger.error(AiUsageEventsLogEvent.StatusFailed, cause, { workspaceId })
            return null
        }
    }

    /** The browser's quota read: absence is nullable, while a database failure propagates to the caller. */
    async readQuotaStatus(workspaceId: string): Promise<QuotaLookup> {
        return quotaLookupOf((await this.quotaRecords(workspaceId)).map(quotaFiguresOf))
    }

    /** Current-month use for the billing card, after the application proves the caller's manager role. */
    async usageSummary(workspaceId: string): Promise<UsageSummary> {
        const status = await this.readQuotaStatus(workspaceId)
        const rows = await this.entityManager
            .createQueryBuilder(AiUsageEventEntity, "e")
            .select("to_char(e.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD')", "day")
            .addSelect("COALESCE(e.module, 'other')", "module")
            .addSelect("COUNT(*)::float8", "calls")
            .addSelect("SUM(e.prompt_tokens + e.completion_tokens)::float8", "tokens")
            .addSelect("SUM(e.cost_usd)::float8", "cost_usd")
            .where("e.workspace_id = :workspaceId", { workspaceId })
            .andWhere("e.kind <> 'guide' AND e.failure IS NULL")
            .andWhere(
                "e.created_at >= (date_trunc('month', current_timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh') AT TIME ZONE 'Asia/Ho_Chi_Minh')",
            )
            .groupBy("1")
            .addGroupBy("e.module")
            .orderBy("day", "ASC")
            .addOrderBy("module", "ASC")
            .limit(MONTHLY_ROW_LIMIT)
            .getRawMany<MonthlyUsageAggregate>()
        return toUsageSummary(status, rows.map(toDailyModuleUsage))
    }

    /** The model cost from a selected day onward, used by the credits run-out forecast. */
    async recentCostUsd(workspaceId: string, from: string): Promise<number> {
        const row = await this.entityManager
            .createQueryBuilder(AiUsageEventEntity, "e")
            .select("COALESCE(SUM(e.cost_usd), 0)::float8", "cost_usd")
            .where("e.workspace_id = :workspaceId", { workspaceId })
            .andWhere("e.kind <> 'guide' AND e.failure IS NULL")
            .andWhere("e.created_at >= (CAST(:from AS date)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')", { from })
            .getRawOne<{ cost_usd: number }>()
        return row?.cost_usd ?? 0
    }

    /** The credits one module used in the last `days` days; every call counts as whole credits, rounded up. */
    async creditsUsedBy(workspaceId: string, module: string, days: number): Promise<number> {
        const row = await this.entityManager
            .createQueryBuilder(AiUsageEventEntity, "u")
            .select("COALESCE(sum(ceil(u.cost_usd / :creditUsd)), 0)::int", "credits")
            .where("u.workspace_id = :workspaceId AND u.module = :module AND u.failure IS NULL", {
                workspaceId,
                module,
                creditUsd: CREDIT_USD_VALUE,
            })
            .andWhere("u.created_at >= now() - CAST(:days AS integer) * interval '1 day'", { days })
            .getRawOne<{ credits: number }>()
        return row?.credits ?? 0
    }

    /** The credits each module used between two instants (the guide never counts), whole credits per call, one grouped statement. */
    async creditsByModule(workspaceId: string, from: Date, to: Date): Promise<ReadonlyMap<string, number>> {
        const rows = await this.entityManager
            .createQueryBuilder(AiUsageEventEntity, "u")
            .select("COALESCE(u.module, 'other')", "module")
            .addSelect("COALESCE(sum(ceil(u.cost_usd / :creditUsd)), 0)::int", "credits")
            .where("u.workspace_id = :workspaceId AND u.kind <> 'guide' AND u.failure IS NULL", {
                workspaceId,
                creditUsd: CREDIT_USD_VALUE,
            })
            .andWhere("u.created_at >= :from AND u.created_at < :to", { from, to })
            .groupBy("1")
            .limit(MODULE_ROW_LIMIT)
            .getRawMany<{ module: string; credits: number }>()
        return new Map(rows.map((row) => [row.module, row.credits]))
    }

    /** The credits each run used, whole credits per call (the guide never counts), for the runs given; a run with no call is absent. */
    async creditsByRun(workspaceId: string, runIds: ReadonlyArray<string>): Promise<ReadonlyMap<string, number>> {
        if (runIds.length === 0) return new Map()
        const rows = await this.entityManager
            .createQueryBuilder(AiUsageEventEntity, "u")
            .select("u.run_id", "run_id")
            .addSelect("COALESCE(sum(ceil(u.cost_usd / :creditUsd)), 0)::int", "credits")
            .where("u.workspace_id = :workspaceId AND u.kind <> 'guide' AND u.failure IS NULL", {
                workspaceId,
                creditUsd: CREDIT_USD_VALUE,
            })
            .andWhere("u.run_id IN (:...runIds)", { runIds })
            .groupBy("u.run_id")
            .limit(runIds.length)
            .getRawMany<{ run_id: string; credits: number }>()
        return new Map(rows.map((row) => [row.run_id, row.credits]))
    }

    /**
     * The model calls of one run grouped by step and call kind (the guide never counts), for the run page: the answers and every try
     * (failed tries included, booked estimated), the highest try, the prompt, cached, cache-written, completion and reasoning tokens of
     * the answers, the time, the exact cost of the answers and of the failed tries, the models, upstreams and finish reasons. A call
     * booked without a kind is grouped under its usage kind; a call booked without a step (before migration 014000, or outside a node)
     * has none. Ordered by the first call of each group. Served by `ai_usage_events_run_idx`.
     */
    async callKindsByRun(workspaceId: string, runId: string): Promise<ReadonlyArray<RunCallKindUsage>> {
        const grouped = RUN_KIND_SUMS.reduce(
            (query, [expression, alias]) => query.addSelect(expression, alias),
            this.entityManager
                .createQueryBuilder(AiUsageEventEntity, "u")
                .select("u.step_key", "step_key")
                .addSelect("COALESCE(u.purpose, u.kind)", "purpose"),
        )
        const rows = await grouped
            .where("u.workspace_id = :workspaceId AND u.run_id = :runId AND u.kind <> 'guide'", { workspaceId, runId })
            .groupBy("1")
            .addGroupBy("2")
            .orderBy("MIN(u.created_at)", "ASC")
            .limit(RUN_KIND_LIMIT)
            .getRawMany<RunCallKindAggregate>()
        return rows.map((row) => toRunCallKind(row))
    }

    /**
     * Before a model call: the status when the call must NOT be made (over the allowance), else null. Embedding one query and the
     * guide are never blocked; a bulk embedding is real spend and stops with the credits. The owner is told once the limit was reached.
     */
    async blockedBy(workspaceId: string, kind: UsageKind, bulk: boolean): Promise<QuotaLookup> {
        if (kind === "guide" || (kind === "embedding" && !bulk)) return null
        const status = await this.quotaStatus(workspaceId)
        if (status === null || !stopsCall(status, kind)) return null
        await this.notifyOwner(workspaceId, status)
        return status
    }

    private async notifyOwner(workspaceId: string, status: QuotaStatus): Promise<void> {
        const level = noticeLevelOf(status)
        if (level === null) return
        try {
            await callDbFunction<{ usage_notice_post: boolean }>(this.entityManager, "public.usage_notice_post", [
                workspaceId,
                status.periodStart,
                level,
                noticeBody(level, status),
            ])
        } catch (cause) {
            this.logger.error(AiUsageEventsLogEvent.NoticeFailed, cause, { workspaceId })
        }
    }

    /** This month's use of a workspace against its allowance: no row, or one. */
    private quotaRecords(workspaceId: string): Promise<ReadonlyArray<QuotaRecord>> {
        return callDbFunction<QuotaRecord>(this.entityManager, "public.ai_quota_status", [workspaceId])
    }
}
