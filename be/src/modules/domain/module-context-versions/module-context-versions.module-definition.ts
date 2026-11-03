import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { ModuleContextVersionsOptions } from "./module-context-versions.options"

/** The configurable-module base of the module-context-versions capability. */
const definition = new ConfigurableModuleBuilder<ModuleContextVersionsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    ModuleContextVersionsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: ModuleContextVersionsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
