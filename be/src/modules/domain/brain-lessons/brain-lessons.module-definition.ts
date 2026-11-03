import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { BrainLessonsOptions } from "./brain-lessons.options"

/** The configurable-module base of the brain-lessons capability. */
const definition = new ConfigurableModuleBuilder<BrainLessonsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    BrainLessonsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: BrainLessonsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
