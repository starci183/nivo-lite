import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { ModuleSetupSessionsOptions } from "./module-setup-sessions.options"

/** The configurable-module base of the module-setup-sessions capability. */
const definition = new ConfigurableModuleBuilder<ModuleSetupSessionsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    ModuleSetupSessionsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: ModuleSetupSessionsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
