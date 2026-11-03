import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { AiGenerationsOptions } from "./ai-generations.options"

/** The configurable-module base of the ai-generations capability. */
const definition = new ConfigurableModuleBuilder<AiGenerationsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    AiGenerationsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: AiGenerationsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
