import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import type { QuotaStatus, UsageKind, UsageRecord } from "./knowledge.contracts"
import { KnowledgeLogEvent } from "./knowledge.log-events"
import type { QuotaStatusRow } from "./persistence/usage.rows"
import { POST_USAGE_NOTICE, RECORD_USAGE_EVENT, SELECT_QUOTA_STATUS } from "./persistence/usage.sql"
import { figuresOf, isBlocked, quotaStatusOf } from "./usage.policy"

const number = new Intl.NumberFormat("vi-VN")

/** What the owner is told the workspace has used, as a comma-joined list of the allowances that are set. */
const useOf = (status: QuotaStatus): string => {
    const parts: Array<string> = []
    if (status.creditsLimit !== null) {
        parts.push(`${number.format(Math.round(status.creditsUsed))}/${number.format(status.creditsLimit)} credit`)
    }
    if (status.topupBalance > 0) parts.push(`${number.format(status.topupBalance)} credit +`)
    if (status.messagesLimit !== null) {
        parts.push(`${number.format(status.messagesUsed)}/${number.format(status.messagesLimit)} messages`)
    }
    if (status.tokensLimit !== null) {
        parts.push(`${number.format(status.tokensUsed)}/${number.format(status.tokensLimit)} tokens`)
    }
    return parts.join(", ")
}

@Injectable()
/** Meters the model calls of a workspace against its allowance and tells the owner once per month and level when it runs short. */
export class UsageMeterService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** Records one model call. Never throws: metering must not break the work it measures. */
    async record(input: UsageRecord): Promise<void> {
        try {
            const figures = figuresOf({
                model: input.model,
                usage: input.usage,
                promptChars: input.promptChars ?? 0,
                completionChars: input.completionChars ?? 0,
            })
            await this.entityManager.query(RECORD_USAGE_EVENT, [
                input.workspaceId,
                input.kind,
                input.module,
                input.model.slice(0, 120),
                Math.round(figures.promptTokens),
                Math.round(figures.completionTokens),
                Number(figures.costUsd.toFixed(8)),
                figures.estimated,
            ])
            const status = await this.statusOf(input.workspaceId)
            if (status === null) return
            const level = status.level
            if (level !== "ok") await this.notify(input.workspaceId, status, level)
        } catch (cause) {
            this.logger.error(KnowledgeLogEvent.UsageRecordFailed, cause, { workspaceId: input.workspaceId })
        }
    }

    /** True when a call of `kind` must NOT be made because the allowance is used up; fails open when the allowance cannot be read. */
    async blockedBy(workspaceId: string, kind: UsageKind, bulk: boolean): Promise<boolean> {
        const status = await this.statusOf(workspaceId)
        if (status === null || !isBlocked(kind, status, bulk)) return false
        await this.notify(workspaceId, status, "exceeded")
        return true
    }

    /** This month's use against the allowance; null when it cannot be read. */
    private async statusOf(workspaceId: string): Promise<QuotaStatus | null> {
        try {
            const [row] = await this.entityManager.query<Array<QuotaStatusRow>>(SELECT_QUOTA_STATUS, [workspaceId])
            return row === undefined ? null : quotaStatusOf(row)
        } catch (cause) {
            this.logger.error(KnowledgeLogEvent.QuotaReadFailed, cause, { workspaceId })
            return null
        }
    }

    /** Posts the notice of the month and level; the database function posts it once. */
    private async notify(workspaceId: string, status: QuotaStatus, level: "warn" | "exceeded"): Promise<void> {
        try {
            const body = this.catalog.get(
                `usage.notice.${level}`,
                { percent: Math.round(status.ratio * 100), use: useOf(status) },
                "vi",
            )
            await this.entityManager.query(POST_USAGE_NOTICE, [workspaceId, status.periodStart, level, body])
        } catch (cause) {
            this.logger.error(KnowledgeLogEvent.NoticeFailed, cause, { workspaceId })
        }
    }
}
