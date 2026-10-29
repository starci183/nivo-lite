import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { AiTasksWiring } from "./ai-tasks.options"

/** The configurable-module base of the prompt library. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<AiTasksWiring>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
