import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import { KNOWLEDGE_OPTIONS } from "./knowledge.decorators"
import type { KnowledgeOptions } from "./knowledge.options"

/** The configurable-module base of the knowledge capability; `isGlobal` is decided by the app root. */
const definition = new ConfigurableModuleBuilder<KnowledgeOptions>({
    optionsInjectionToken: KNOWLEDGE_OPTIONS,
})
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    KnowledgeOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: KnowledgeOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
