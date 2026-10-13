import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ContentAiOptions } from "./content-ai.options"

/** Configurable registration base with global scope selected by the root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<ContentAiOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
