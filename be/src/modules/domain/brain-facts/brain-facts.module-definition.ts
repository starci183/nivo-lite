import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { BrainFactsOptions } from "./brain-facts.options"

/** The configurable-module base of the brain-facts capability. */
const definition = new ConfigurableModuleBuilder<BrainFactsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    BrainFactsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: BrainFactsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
