import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { callDbFunction, InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { noticeBody, noticeLevelOf } from "./notice.policy"
import { AiUsageEventEntity } from "./persistence/entities"
import { quotaFiguresOf, quotaLookupOf, quotaOf, stopsCall } from "./quota.policy"
import type {
    QuotaLookup,
    QuotaRecord,
    QuotaStatus,
    UsageInput,
    UsageKind,
    UsageSummary,
} from "./ai-usage-events.contracts"
import { AiUsageEventsLogEvent } from "./ai-usage-events.log-events"
import { figuresOf } from "./usage-cost.policy"
import { toDailyModuleUsage, toUsageSummary } from "./usage-summary.mapper"
import type { MonthlyUsageAggregate } from "./usage-summary.mapper"

/** The most day-and-module rollups the billing card reads. */
const MONTHLY_ROW_LIMIT = 2000

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
            const figures = figuresOf(input, input.usage)
            await this.entityManager.insert(AiUsageEventEntity, {
                workspaceId: input.workspaceId,
                kind: input.kind,
                module: input.module,
                model: input.model.slice(0, 120),
                promptTokens: figures.promptTokens,
                completionTokens: figures.completionTokens,
                costUsd: String(figures.costUsd),
                estimated: figures.estimated,
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
            .andWhere("e.kind <> 'guide'")
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
            .andWhere("e.kind <> 'guide'")
            .andWhere("e.created_at >= (CAST(:from AS date)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')", { from })
            .getRawOne<{ cost_usd: number }>()
        return row?.cost_usd ?? 0
    }

    /** The credits one module used in the last `days` days; every call counts as whole credits, rounded up. */
    async creditsUsedBy(workspaceId: string, module: string, days: number): Promise<number> {
        const [value] = await callDbFunction<{ credit_usd_value: string | number }>(
            this.entityManager,
            "public.credit_usd_value",
            [],
        )
        const creditUsd = Number(value?.credit_usd_value ?? 0)
        const row = await this.entityManager
            .createQueryBuilder(AiUsageEventEntity, "u")
            .select("COALESCE(sum(ceil(u.cost_usd / :creditUsd)), 0)::int", "credits")
            .where("u.workspace_id = :workspaceId AND u.module = :module", { workspaceId, module, creditUsd })
            .andWhere("u.created_at >= now() - CAST(:days AS integer) * interval '1 day'", { days })
            .getRawOne<{ credits: number }>()
        return row?.credits ?? 0
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
