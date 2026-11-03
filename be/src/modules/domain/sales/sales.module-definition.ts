import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { SalesOptions } from "./sales.options"

/** The configurable module base of the Sales capability. */
const definition = new ConfigurableModuleBuilder<SalesOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    SalesOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: SalesOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
