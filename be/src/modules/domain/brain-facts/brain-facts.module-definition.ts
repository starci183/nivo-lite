import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { BrainFactsOptions } from "./brain-facts.options"

/** The configurable-module base of the brain-facts capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<BrainFactsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
