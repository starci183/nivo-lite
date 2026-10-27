import { ConfigurableModuleBuilder } from "@nestjs/common"
import { AI_POOL_OPTIONS } from "./ai-pool.decorators"
import type { AiPoolOptions } from "./ai-pool.options"

/** The configurable-module base of the AI pool; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<AiPoolOptions>({
    optionsInjectionToken: AI_POOL_OPTIONS,
})
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
