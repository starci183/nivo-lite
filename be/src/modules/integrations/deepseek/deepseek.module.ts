import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { DeepseekClient } from "./deepseek.client"
import { DEEPSEEK_OPTIONS, DEEPSEEK_TEXT_GENERATOR } from "./deepseek.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./deepseek.module-definition"

@Module({})
/** The prompt library. The app root provides the `DEEPSEEK_TEXT_GENERATOR` port it generates through. */
export class DeepseekModule extends ConfigurableModuleClass {
    /** Registers the library once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        const { isGlobal: _isGlobal, generator, ...parsed } = options
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                { provide: DEEPSEEK_OPTIONS, useValue: parsed },
                { provide: DEEPSEEK_TEXT_GENERATOR, useExisting: generator },
                DeepseekClient,
            ],
            exports: [DeepseekClient],
        }
    }
}
