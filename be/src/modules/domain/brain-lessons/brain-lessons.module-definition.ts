import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { BrainLessonsOptions } from "./brain-lessons.options"

/** The configurable-module base of the brain-lessons capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<BrainLessonsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
