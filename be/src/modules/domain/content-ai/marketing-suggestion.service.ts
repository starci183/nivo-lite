import { Injectable } from "@nestjs/common"
import { DirectGenerationService } from "@modules/domain/ai-generations"
import type { Locale } from "@modules/platform/i18n"
import type { WeeklySuggestion } from "@modules/domain/content-weekly-reports"
import { BrandKitService } from "./brand-kit.service"
import type { MarketingWeeklyReport } from "./content-agent.contracts"
import { readSuggestion, suggestionMessages, suggestionSourcesOf } from "./report-suggestion.policy"

/** How long the report waits for the model. */
const SUGGESTION_TIMEOUT_MS = 45_000

@Injectable()
/**
 * The advice of the weekly marketing report: the model reads the week's numbers and top posts in the confirmed brand and
 * answers one suggestion for the next week, with the sources it was given. A week with nothing to read, a refused or failed
 * generation and an unreadable answer all yield no suggestion; the report never fails on it.
 */
export class MarketingSuggestionService {
    constructor(
        private readonly generations: DirectGenerationService,
        private readonly brand: BrandKitService,
    ) {}

    /** The suggestion of the week, or null when the week holds no engagement and no post or the model gave none. */
    async suggest(
        workspaceId: string,
        locale: Locale,
        report: MarketingWeeklyReport,
    ): Promise<WeeklySuggestion | null> {
        if (report.engagements.value === 0 && report.postCount === 0) return null
        const brand = await this.brand.brandOf(workspaceId)
        const outcome = await this.generations.run({
            workspaceId,
            purpose: "marketing_report",
            responseFormat: "json",
            timeoutMs: SUGGESTION_TIMEOUT_MS,
            kind: "engine",
            module: "content",
            locale,
            messages: suggestionMessages(report, brand.kit, locale),
        })
        const text = outcome.ok ? readSuggestion(outcome.output) : null
        return text === null ? null : { ...text, sources: suggestionSourcesOf(report, brand.kit) }
    }
}
