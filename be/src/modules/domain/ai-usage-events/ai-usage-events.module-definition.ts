import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { AiUsageEventsOptions } from "./ai-usage-events.options"

/** The configurable-module base of the usage capability. */
const definition = new ConfigurableModuleBuilder<AiUsageEventsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    AiUsageEventsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: AiUsageEventsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
