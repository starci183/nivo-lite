import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import { MODULES_OPTIONS } from "./modules.decorators"
import type { ModulesOptions } from "./modules.options"

/** The configurable-module base of the modules capability; `isGlobal` is decided by the app root. */
const definition = new ConfigurableModuleBuilder<ModulesOptions>({
    optionsInjectionToken: MODULES_OPTIONS,
})
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    ModulesOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: ModulesOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
