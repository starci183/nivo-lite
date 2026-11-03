import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { ModuleInstallationsOptions } from "./module-installations.options"

/** The configurable-module base of the module-installations capability. */
const definition = new ConfigurableModuleBuilder<ModuleInstallationsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    ModuleInstallationsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: ModuleInstallationsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
