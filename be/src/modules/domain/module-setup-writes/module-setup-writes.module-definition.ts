import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { ModuleSetupWritesOptions } from "./module-setup-writes.options"

/** The configurable-module base of the module-setup-writes capability. */
const definition = new ConfigurableModuleBuilder<ModuleSetupWritesOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    ModuleSetupWritesOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: ModuleSetupWritesOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
