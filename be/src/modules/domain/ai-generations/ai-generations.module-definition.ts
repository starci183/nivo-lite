import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { AiGenerationsOptions } from "./ai-generations.options"

/** The configurable-module base of the ai-generations capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<AiGenerationsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
