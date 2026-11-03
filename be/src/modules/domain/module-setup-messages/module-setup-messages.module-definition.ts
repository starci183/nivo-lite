import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { ModuleSetupMessagesOptions } from "./module-setup-messages.options"

/** The configurable-module base of the module-setup-messages capability. */
const definition = new ConfigurableModuleBuilder<ModuleSetupMessagesOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    ModuleSetupMessagesOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: ModuleSetupMessagesOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
