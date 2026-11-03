import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { ContentWeeklyReportsOptions } from "./content-weekly-reports.options"

/** Configurable registration of the content-weekly-reports capability. */
const definition = new ConfigurableModuleBuilder<ContentWeeklyReportsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    ContentWeeklyReportsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: ContentWeeklyReportsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
