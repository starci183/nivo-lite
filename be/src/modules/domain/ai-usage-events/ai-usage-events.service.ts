import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { noticeBody, noticeLevelOf } from "./notice.policy"
import type { DailyModuleUsageRow, QuotaRow, RecentCostRow } from "./persistence/ai-usage-events.rows"
import {
    INSERT_USAGE_EVENT,
    POST_USAGE_NOTICE,
    SELECT_MONTHLY_USAGE,
    SELECT_QUOTA_STATUS,
    SELECT_RECENT_COST,
} from "./persistence/ai-usage-events.sql"
import { quotaLookupOf, quotaOf, stopsCall } from "./quota.policy"
import type { QuotaLookup, QuotaStatus, UsageInput, UsageKind, UsageSummary } from "./ai-usage-events.contracts"
import { AiUsageEventsLogEvent } from "./ai-usage-events.log-events"
import { figuresOf } from "./usage-cost.policy"
import { toDailyModuleUsage, toUsageSummary } from "./usage-summary.mapper"

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
            await this.entityManager.query(INSERT_USAGE_EVENT, [
                input.workspaceId,
                input.kind,
                input.module,
                input.model.slice(0, 120),
                figures.promptTokens,
                figures.completionTokens,
                figures.costUsd,
                figures.estimated,
            ])
            const status = await this.quotaStatus(input.workspaceId)
            if (status !== null) await this.notifyOwner(input.workspaceId, status)
        } catch (cause) {
            this.logger.error(AiUsageEventsLogEvent.RecordFailed, cause, { workspaceId: input.workspaceId })
        }
    }

    /** This month's use against the allowance, or null when it cannot be read (metering then fails open). */
    async quotaStatus(workspaceId: string): Promise<QuotaLookup> {
        try {
            const [row] = await this.entityManager.query<Array<QuotaRow>>(SELECT_QUOTA_STATUS, [workspaceId])
            return row === undefined ? null : quotaOf(row)
        } catch (cause) {
            this.logger.error(AiUsageEventsLogEvent.StatusFailed, cause, { workspaceId })
            return null
        }
    }

    /** The browser's quota read: absence is nullable, while a database failure propagates to the caller. */
    async readQuotaStatus(workspaceId: string): Promise<QuotaLookup> {
        return quotaLookupOf(await this.entityManager.query<Array<QuotaRow>>(SELECT_QUOTA_STATUS, [workspaceId]))
    }

    /** Current-month use for the billing card, after the application proves the caller's manager role. */
    async usageSummary(workspaceId: string): Promise<UsageSummary> {
        const status = await this.readQuotaStatus(workspaceId)
        const rows = await this.entityManager.query<Array<DailyModuleUsageRow>>(SELECT_MONTHLY_USAGE, [workspaceId])
        return toUsageSummary(status, rows.map(toDailyModuleUsage))
    }

    /** The model cost from a selected day onward, used by the credits run-out forecast. */
    async recentCostUsd(workspaceId: string, from: string): Promise<number> {
        const [row] = await this.entityManager.query<Array<RecentCostRow>>(SELECT_RECENT_COST, [workspaceId, from])
        return row?.cost_usd ?? 0
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
            await this.entityManager.query(POST_USAGE_NOTICE, [
                workspaceId,
                status.periodStart,
                level,
                noticeBody(level, status),
            ])
        } catch (cause) {
            this.logger.error(AiUsageEventsLogEvent.NoticeFailed, cause, { workspaceId })
        }
    }
}
