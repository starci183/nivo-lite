import { ConfigurableModuleBuilder } from "@nestjs/common"
import { BRAIN_OPTIONS } from "./brain.decorators"
import type { BrainOptions } from "./brain.options"

/** The configurable-module base of the brain capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<BrainOptions>({
    optionsInjectionToken: BRAIN_OPTIONS,
})
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
