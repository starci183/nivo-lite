import { Injectable, Optional } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import {
    InjectUsageNoticeDoor,
    usageNoticeKeyOf,
    type UsageNoticeDoor,
    workColumnsOf,
    workFactsJsonOf,
} from "@modules/domain/ai-usage-events"
import { callDbFunction, InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger, runInScope, workInScope, type Logger } from "@modules/platform/logging"
import { InjectMessageCatalog, type MessageCatalog } from "@modules/platform/i18n"
import type { QuotaStatus, UsageKind, UsageRecord } from "./knowledge.contracts"
import { KnowledgeLogEvent } from "./knowledge.log-events"
import type { QuotaStatusRow } from "./persistence/usage.rows"
import { figuresOf, isBlocked, quotaStatusOf, tokenFactsOf } from "./usage.policy"

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
        @Optional() @InjectUsageNoticeDoor() private readonly notices: UsageNoticeDoor | null = null,
    ) {}

    /**
     * Records one model call with the work it served: the run in scope, and the work in scope (the document or lesson a job reads,
     * the step and agent of a node), so the document and run reads can show it. A failed try (`failure`: timeout, provider error, cut at
     * its cap, empty) is never billed (concept.tokens-and-credits): one that reported its usage (a cut try) is booked with those real
     * figures, one that reported none is booked estimated from its prompt. Never throws: metering must not break the work it measures.
     */
    async record(input: UsageRecord): Promise<void> {
        try {
            const reported = input.failure === undefined || input.usage !== null
            const priced = figuresOf({
                model: input.model,
                usage: input.usage,
                promptChars: input.promptChars ?? 0,
                completionChars: input.failure === undefined ? (input.completionChars ?? 0) : 0,
            })
            const figures = reported ? priced : { ...priced, estimated: true }
            const work = workColumnsOf(workInScope(), null, figures, input.failure)
            await callDbFunction(this.entityManager, "public.record_ai_usage_work", [
                input.workspaceId,
                input.kind,
                input.module,
                input.model.slice(0, 120),
                Math.round(figures.promptTokens),
                Math.round(figures.completionTokens),
                Number(figures.costUsd.toFixed(8)),
                figures.estimated,
                JSON.stringify({
                    ...workFactsJsonOf(work, runInScope(), {
                        // One record is one try of one call: a caller that retries says which; any other call is its first try.
                        tryNumber: input.tryNumber ?? 1,
                        durationMs: input.served?.durationMs ?? null,
                        upstream: input.served?.upstream ?? null,
                        finishReason: input.served?.finishReason ?? null,
                    }),
                    // What the provider served from its prompt cache, wrote to it, and thought: the row shows why a call cost what it did.
                    ...tokenFactsOf(input.usage, figures.estimated),
                }),
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
            const [row] = await callDbFunction<QuotaStatusRow>(this.entityManager, "public.ai_quota_status", [
                workspaceId,
            ])
            return row === undefined ? null : quotaStatusOf(row)
        } catch (cause) {
            this.logger.error(KnowledgeLogEvent.QuotaReadFailed, cause, { workspaceId })
            return null
        }
    }

    /** Tells the founder in /chat once per month and level; where no chat is composed (the mcp gateway) nobody is told. */
    private async notify(workspaceId: string, status: QuotaStatus, level: "warn" | "exceeded"): Promise<void> {
        if (this.notices === null) return
        try {
            const body = this.catalog.get(
                `usage.notice.${level}`,
                { percent: Math.round(status.ratio * 100), use: useOf(status) },
                "vi",
            )
            await this.notices.postNotice(workspaceId, { key: usageNoticeKeyOf(status.periodStart, level), body })
        } catch (cause) {
            this.logger.error(KnowledgeLogEvent.NoticeFailed, cause, { workspaceId })
        }
    }
}
