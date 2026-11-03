import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { SalesWorkbenchOptions } from "./sales-workbench.options"

/** The configurable module base of the Sales workbench projection. */
const definition = new ConfigurableModuleBuilder<SalesWorkbenchOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    SalesWorkbenchOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: SalesWorkbenchOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
