import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { ContentEngagementDailyOptions } from "./content-engagement-daily.options"

/** Configurable registration of the content-engagement-daily capability. */
const definition = new ConfigurableModuleBuilder<ContentEngagementDailyOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    ContentEngagementDailyOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: ContentEngagementDailyOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
