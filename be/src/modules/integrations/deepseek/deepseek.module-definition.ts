import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { DeepseekOptions } from "./deepseek.options"

/** The configurable-module base of the prompt library. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<DeepseekOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
