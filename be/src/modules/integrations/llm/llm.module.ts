import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { LlmClient } from "./llm.client"
import { LLM, LLM_POOL } from "./llm.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./llm.module-definition"

@Module({})
/** Provides the language-model port: embeddings for search and chat completions for reading facts out of documents. */
export class LlmModule extends ConfigurableModuleClass {
    /** Registers the integration once per app that embeds text or reads facts; the app root names the AI pool it calls through. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                { provide: LLM_POOL, useExisting: options.pool },
                { provide: LLM, useClass: LlmClient },
            ],
            exports: [LLM],
        }
    }
}
