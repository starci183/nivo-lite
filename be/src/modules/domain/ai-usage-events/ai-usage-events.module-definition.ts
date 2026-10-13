import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { AiUsageEventsOptions } from "./ai-usage-events.options"

/** The configurable-module base of the usage capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<AiUsageEventsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
