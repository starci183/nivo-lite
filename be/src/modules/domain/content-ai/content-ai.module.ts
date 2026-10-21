import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ContentBrandProposalsModule } from "@modules/domain/content-brand-proposals"
import { ContentEngagementDailyModule } from "@modules/domain/content-engagement-daily"
import { ContentWeeklyReportsModule } from "@modules/domain/content-weekly-reports"
import { BrandImagesService } from "./brand-images.service"
import { BrandKitService } from "./brand-kit.service"
import { MARKETING_ASSETS } from "./content-agent.decorators"
import { ContentAgentPerformersService } from "./content-agent-performers.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./content-ai.module-definition"
import { ContentAiService } from "./content-ai.service"
import { ContentBrandService } from "./content-brand.service"
import { ContentAiCompletionService } from "./content-ai-completion.service"
import { ContentGenerationCompletionService } from "./content-generation-completion.service"
import { ContentScheduleService } from "./content-schedule.service"
import { MarketingCardsService } from "./marketing-cards.service"
import { MarketingDraftService } from "./marketing-draft.service"
import { MarketingVideoService } from "./marketing-video.service"
import { MarketingInsightsService } from "./marketing-insights.service"
import { MarketingKnowledgeService } from "./marketing-knowledge.service"
import { MarketingChannelsService } from "./marketing-channels.service"
import { MarketingTickService } from "./marketing-tick.service"
import { MarketingSuggestionService } from "./marketing-suggestion.service"

@Module({})
/**
 * Content prompts and orchestration over the existing generation queue, and the content agent (AI Marketing): brand kit from a
 * guideline PDF, drafts from the Marketing room, scheduling on Meta and Zalo after approval, insights and the weekly report.
 */
export class ContentAiModule extends ConfigurableModuleClass {
    /** Registers once; capabilities used here are composed globally by the application; `assets` is the object writer token. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            imports: [
                ...(base.imports ?? []),
                ContentBrandProposalsModule.register({ isGlobal: false }),
                ContentEngagementDailyModule.register({ isGlobal: false }),
                ContentWeeklyReportsModule.register({ isGlobal: false }),
            ],
            providers: [
                ...(base.providers ?? []),
                { provide: MARKETING_ASSETS, useExisting: options.assets },
                ContentAiService,
                ContentBrandService,
                ContentAiCompletionService,
                ContentGenerationCompletionService,
                BrandKitService,
                BrandImagesService,
                MarketingCardsService,
                MarketingDraftService,
                MarketingVideoService,
                ContentScheduleService,
                MarketingInsightsService,
                MarketingSuggestionService,
                MarketingKnowledgeService,
                MarketingChannelsService,
                MarketingTickService,
                ContentAgentPerformersService,
            ],
            exports: [
                ContentAiService,
                ContentGenerationCompletionService,
                BrandKitService,
                MarketingInsightsService,
                MarketingTickService,
            ],
        }
    }
}
