import { Injectable } from "@nestjs/common"
import type { OptionalQuotaBlock, UsageGate, GenerationUsageRecord } from "@modules/domain/ai-generations"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { Locale, MessageCatalog } from "@modules/platform/i18n"
import { AiUsageEventsService } from "./ai-usage-events.service"
import { usageKindOf } from "./usage-kind.policy"

/** The model name booked when a run reports none. */
const DEFAULT_MODEL = "openclaw"

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

    /** Meters one finished generation. */
    record(entry: GenerationUsageRecord): Promise<void> {
        const run = entry.usage
        return this.usage.record({
            workspaceId: entry.workspaceId,
            kind: usageKindOf(entry.kind),
            module: entry.module,
            model: run?.model ?? DEFAULT_MODEL,
            usage:
                run === null
                    ? null
                    : {
                          prompt_tokens: run.prompt_tokens,
                          completion_tokens: run.completion_tokens,
                          total_tokens: run.prompt_tokens + run.completion_tokens,
                          cost: run.cost,
                      },
            promptChars: entry.promptChars ?? 0,
            completionChars: entry.completionChars,
        })
    }
}
