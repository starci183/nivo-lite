import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { DeepseekClient } from "./deepseek.client"
import {
    DEEPSEEK_CLIENT,
    DEEPSEEK_METER,
    DEEPSEEK_OPTIONS,
    DEEPSEEK_POOL,
    DEEPSEEK_TEXT_GENERATOR,
} from "./deepseek.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./deepseek.module-definition"

@Module({})
/** The prompt library. The app root names the AI pool, the OpenClaw door used while the pool has no key, and the usage meter. */
export class DeepseekModule extends ConfigurableModuleClass {
    /** Registers the library once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        const { isGlobal: _isGlobal, generator, pool, meter, ...parsed } = options
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                { provide: DEEPSEEK_OPTIONS, useValue: parsed },
                { provide: DEEPSEEK_TEXT_GENERATOR, useExisting: generator },
                { provide: DEEPSEEK_POOL, useExisting: pool },
                { provide: DEEPSEEK_METER, useExisting: meter },
                DeepseekClient,
                { provide: DEEPSEEK_CLIENT, useExisting: DeepseekClient },
            ],
            exports: [DeepseekClient, DEEPSEEK_CLIENT],
        }
    }
}
