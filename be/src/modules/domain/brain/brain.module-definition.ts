import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import { BRAIN_OPTIONS } from "./brain.decorators"
import type { BrainOptions } from "./brain.options"

/** The configurable-module base of the brain capability; `isGlobal` is decided by the app root. */
const definition = new ConfigurableModuleBuilder<BrainOptions>({
    optionsInjectionToken: BRAIN_OPTIONS,
})
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    BrainOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: BrainOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
