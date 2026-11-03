import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { KnowledgeChunksOptions } from "./knowledge-chunks.options"

/** The configurable-module base of the knowledge-chunks capability. */
const definition = new ConfigurableModuleBuilder<KnowledgeChunksOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    KnowledgeChunksOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: KnowledgeChunksOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
