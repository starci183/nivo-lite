import { Injectable } from "@nestjs/common"
import type { OptionalQuotaBlock, UsageGate, GenerationUsageRecord } from "@modules/domain/ai-generations"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { Locale, MessageCatalog } from "@modules/platform/i18n"
import type { UsageCallFacts, UsageWork } from "./ai-usage-events.contracts"
import { AiUsageEventsService } from "./ai-usage-events.service"
import { usageKindOf } from "./usage-kind.policy"

/**
 * One finished generation as the gate books it: the generations port's record, and, from the prompt library (`AiTaskMeter`), what
 * the call was and how it went. A record without it books none of that.
 */
export type MeteredGeneration = GenerationUsageRecord & {
    /** What the call was and how it went (kind, hidden reasoning, time, try, upstream, finish); absent books none of it. */
    readonly call?: UsageCallFacts | undefined
    /** The model a record with no usage asked for (a failed try), to price its estimate; absent books `unknown`. */
    readonly model?: string | undefined
    /** The failure of a FAILED try; the row is booked estimated and never billed. */
    readonly failure?: string | undefined
    /** A failed try booked with the provider's own figures (a cut try that reported its usage): not estimated, still never billed. */
    readonly reported?: boolean | undefined
    /** The work the call was made for (a queued generation carries its caller's); absent, the work in scope. */
    readonly work?: UsageWork | undefined
}

/** The model name booked when a run reports none. */
const DEFAULT_MODEL = "unknown"

@Injectable()
/** The plan allowance and the usage meter the text generations run through: the usage capability behind the generations port. */
export class UsageGateService implements UsageGate {
    constructor(
        private readonly usage: AiUsageEventsService,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
    ) {}

    /** The block when the workspace has used its allowance for the kind. */
    async blockedBy(workspaceId: string, kind: string, locale: Locale): Promise<OptionalQuotaBlock> {
        const status = await this.usage.blockedBy(workspaceId, usageKindOf(kind), false)
        return status === null ? null : { message: this.catalog.get("usage.exceeded", {}, locale) }
    }

    /** Meters one finished generation, with what the call was and how it went when the caller told it. */
    record(entry: MeteredGeneration): Promise<void> {
        const run = entry.usage
        return this.usage.record({
            workspaceId: entry.workspaceId,
            kind: usageKindOf(entry.kind),
            module: entry.module,
            model: run?.model ?? entry.model ?? DEFAULT_MODEL,
            usage:
                run === null
                    ? null
                    : {
                          prompt_tokens: run.prompt_tokens,
                          completion_tokens: run.completion_tokens,
                          total_tokens: run.prompt_tokens + run.completion_tokens,
                          cost: run.cost,
                          cached_tokens: run.cached_tokens,
                          ...(run.cache_write_tokens === undefined
                              ? {}
                              : { cache_write_tokens: run.cache_write_tokens }),
                      },
            promptChars: entry.promptChars ?? 0,
            completionChars: entry.completionChars,
            runId: entry.runId,
            ...(entry.call === undefined ? {} : { call: entry.call }),
            ...(entry.failure === undefined ? {} : { failure: entry.failure }),
            ...(entry.reported === true ? { reported: true } : {}),
            ...(entry.work === undefined ? {} : { work: entry.work }),
        })
    }
}
