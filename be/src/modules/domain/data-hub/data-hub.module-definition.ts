import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { DataHubOptions } from "./data-hub.options"

/** The configurable-module base of the data-hub capability. */
const definition = new ConfigurableModuleBuilder<DataHubOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    DataHubOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const MODULE_OPTIONS_TOKEN: string | symbol = definition.MODULE_OPTIONS_TOKEN
export const OPTIONS_TYPE: DataHubOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
