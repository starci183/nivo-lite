import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { OverviewOptions } from "./overview.options"

/** The configurable-module base of the overview capability. */
const definition = new ConfigurableModuleBuilder<OverviewOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    OverviewOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: OverviewOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
