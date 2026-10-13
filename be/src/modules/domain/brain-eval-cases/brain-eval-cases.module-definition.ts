import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { BrainEvalCasesOptions } from "./brain-eval-cases.options"

/** The configurable-module base of the brain-eval-cases capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<BrainEvalCasesOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
