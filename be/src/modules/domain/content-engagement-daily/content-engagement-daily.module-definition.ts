import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ContentEngagementDailyOptions } from "./content-engagement-daily.options"

/** Configurable registration of the content-engagement-daily capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<ContentEngagementDailyOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
