import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ContentWeeklyReportsOptions } from "./content-weekly-reports.options"

/** Configurable registration of the content-weekly-reports capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<ContentWeeklyReportsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
