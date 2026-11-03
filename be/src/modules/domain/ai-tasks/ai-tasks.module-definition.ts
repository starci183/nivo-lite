import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { AiTasksWiring } from "./ai-tasks.options"

/** The configurable-module base of the prompt library. */
const definition = new ConfigurableModuleBuilder<AiTasksWiring>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    AiTasksWiring,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: AiTasksWiring &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
