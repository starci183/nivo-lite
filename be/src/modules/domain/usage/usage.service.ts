import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { BillingService } from "@modules/domain/billing"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { noticeBody, noticeLevelOf } from "./notice.policy"
import type { DailyModuleRow, QuotaRow, RecentCostRow } from "./persistence/usage.rows"
import {
    INSERT_USAGE_EVENT,
    POST_USAGE_NOTICE,
    SELECT_DAILY_MODULE_USAGE,
    SELECT_QUOTA_STATUS,
    SELECT_RECENT_COST,
} from "./persistence/usage.sql"
import { quotaOf, stopsCall } from "./quota.policy"
import type { QuotaLookup, QuotaStatus, UsageInput, UsageKind, UsageSummary } from "./usage.contracts"
import { UsageLogEvent } from "./usage.log-events"
import { toUsageSummary } from "./usage.mapper"
import { figuresOf } from "./usage-cost.policy"

@Injectable()
/** Meters every model call of a workspace and answers where the month stands against the allowance; the only writer of ai_usage_events. */
export class UsageService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectLogger() private readonly logger: Logger,
        @InjectClock() private readonly clock: Clock,
        private readonly billing: BillingService,
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
            this.logger.error(UsageLogEvent.RecordFailed, cause, { workspaceId: input.workspaceId })
        }
    }

    /** This month's use against the allowance, or null when it cannot be read (metering then fails open). */
    async quotaStatus(workspaceId: string): Promise<QuotaLookup> {
        try {
            const [row] = await this.entityManager.query<Array<QuotaRow>>(SELECT_QUOTA_STATUS, [workspaceId])
            return row === undefined ? null : quotaOf(row)
        } catch (cause) {
            this.logger.error(UsageLogEvent.StatusFailed, cause, { workspaceId })
            return null
        }
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

    /** This month's figures for the billing card; the caller has proven the workspace role. */
    async summary(workspaceId: string): Promise<UsageSummary> {
        const status = await this.quotaStatus(workspaceId)
        const from = status === null ? this.clock.now().toISOString().slice(0, 8) + "01" : status.periodStart
        const rows = await this.entityManager.query<Array<DailyModuleRow>>(SELECT_DAILY_MODULE_USAGE, [
            workspaceId,
            from,
        ])
        return toUsageSummary(status, rows)
    }

    /** The same figures for an owner or manager of the workspace; refuses anyone else. */
    async summaryForManager(userId: string, workspaceId: string): Promise<UsageSummary> {
        await this.billing.requireManager(userId, workspaceId)
        return this.summary(workspaceId)
    }

    /** The model cost in USD of a workspace from a day on (YYYY-MM-DD), the guide left out. */
    async costSince(workspaceId: string, day: string): Promise<number> {
        const [row] = await this.entityManager.query<Array<RecentCostRow>>(SELECT_RECENT_COST, [workspaceId, day])
        return row === undefined ? 0 : row.cost_usd
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
            this.logger.error(UsageLogEvent.NoticeFailed, cause, { workspaceId })
        }
    }
}
