import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { BrainExtractionsOptions } from "./brain-extractions.options"

/** The configurable-module base of the brain-extractions capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<BrainExtractionsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
