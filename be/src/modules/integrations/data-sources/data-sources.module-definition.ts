import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import { DATA_SOURCES_OPTIONS } from "./data-sources.decorators"
import type { DataSourcesModuleOptions } from "./data-sources.options"

/** The configurable-module base of the data-sources integration; `isGlobal` is decided by the app root. */
const definition = new ConfigurableModuleBuilder<DataSourcesModuleOptions>({
    optionsInjectionToken: DATA_SOURCES_OPTIONS,
})
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    DataSourcesModuleOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const MODULE_OPTIONS_TOKEN: string | symbol = definition.MODULE_OPTIONS_TOKEN
export const OPTIONS_TYPE: DataSourcesModuleOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
