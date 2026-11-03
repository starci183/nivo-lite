import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import { NIVO_KNOWLEDGE_OPTIONS } from "./nivo-knowledge.decorators"
import type { NivoKnowledgeOptions } from "./nivo-knowledge.options"

/** The configurable-module base of the nivo-knowledge capability. */
const definition = new ConfigurableModuleBuilder<NivoKnowledgeOptions>({
    optionsInjectionToken: NIVO_KNOWLEDGE_OPTIONS,
})
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    NivoKnowledgeOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: NivoKnowledgeOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
