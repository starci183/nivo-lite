import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { DeepseekWiring } from "./deepseek.options"

/** The configurable-module base of the prompt library. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<DeepseekWiring>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
