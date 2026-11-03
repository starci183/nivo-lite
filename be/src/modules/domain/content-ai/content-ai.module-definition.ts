import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import { CONTENT_AI_OPTIONS } from "./content-agent.decorators"
import type { ContentAiOptions } from "./content-ai.options"

/** Configurable registration base with global scope selected by the root. */
const definition = new ConfigurableModuleBuilder<ContentAiOptions>({
    optionsInjectionToken: CONTENT_AI_OPTIONS,
})
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    ContentAiOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: ContentAiOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
