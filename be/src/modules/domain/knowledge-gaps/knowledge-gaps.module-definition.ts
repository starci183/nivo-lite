import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { KnowledgeGapsOptions } from "./knowledge-gaps.options"

/** The configurable-module base of the knowledge-gaps capability. */
const definition = new ConfigurableModuleBuilder<KnowledgeGapsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    KnowledgeGapsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: KnowledgeGapsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
