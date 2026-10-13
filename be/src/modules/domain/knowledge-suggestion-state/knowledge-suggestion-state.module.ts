import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./knowledge-suggestion-state.module-definition"
import { KnowledgeSuggestionStateService } from "./knowledge-suggestion-state.service"

@Module({})
/** The knowledge-suggestion-state capability: what a workspace decided about the knowledge it is advised to add. */
export class KnowledgeSuggestionStateModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), KnowledgeSuggestionStateService],
            exports: [KnowledgeSuggestionStateService],
        }
    }
}
