import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import { AI_OPTIONS } from "./ai.decorators"
import type { AiOptions } from "./ai.options"

/** The configurable-module base of the LangChain integration; `isGlobal` is decided by the app root. */
const definition = new ConfigurableModuleBuilder<AiOptions>({
    optionsInjectionToken: AI_OPTIONS,
})
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    AiOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: AiOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
