import { ConfigurableModuleBuilder } from "@nestjs/common"
import { MODULES_OPTIONS } from "./modules.decorators"
import type { ModulesOptions } from "./modules.options"

/** The configurable-module base of the modules capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<ModulesOptions>({
    optionsInjectionToken: MODULES_OPTIONS,
})
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
