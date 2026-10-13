import { ConfigurableModuleBuilder } from "@nestjs/common"
import { HIRING_OPTIONS } from "./hiring.decorators"
import type { HiringOptions } from "./hiring.options"

/** The configurable-module base of the hiring capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<HiringOptions>({
    optionsInjectionToken: HIRING_OPTIONS,
})
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
