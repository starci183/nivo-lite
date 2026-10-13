import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./content-ai.module-definition"
import { ContentAiService } from "./content-ai.service"
import { ContentBrandService } from "./content-brand.service"
import { ContentAiCompletionService } from "./content-ai-completion.service"
import { ContentGenerationCompletionService } from "./content-generation-completion.service"

@Module({})
/** Content prompts and orchestration over the existing generation queue. */
export class ContentAiModule extends ConfigurableModuleClass {
    /** Registers once; capabilities used here are composed globally by the application. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                ContentAiService,
                ContentBrandService,
                ContentAiCompletionService,
                ContentGenerationCompletionService,
            ],
            exports: [ContentAiService, ContentGenerationCompletionService],
        }
    }
}
