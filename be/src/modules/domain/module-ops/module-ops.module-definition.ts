import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { ModuleOpsOptions } from "./module-ops.options"

/** The configurable-module base of the module-ops capability. */
const definition = new ConfigurableModuleBuilder<ModuleOpsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    ModuleOpsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: ModuleOpsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
