import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { BrainExtractionsOptions } from "./brain-extractions.options"

/** The configurable-module base of the brain-extractions capability. */
const definition = new ConfigurableModuleBuilder<BrainExtractionsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    BrainExtractionsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: BrainExtractionsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
