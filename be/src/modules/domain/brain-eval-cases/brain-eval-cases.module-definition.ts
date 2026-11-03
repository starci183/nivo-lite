import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { BrainEvalCasesOptions } from "./brain-eval-cases.options"

/** The configurable-module base of the brain-eval-cases capability. */
const definition = new ConfigurableModuleBuilder<BrainEvalCasesOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    BrainEvalCasesOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: BrainEvalCasesOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
