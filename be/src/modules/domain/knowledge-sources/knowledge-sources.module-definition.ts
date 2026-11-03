import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { KnowledgeSourcesOptions } from "./knowledge-sources.options"

/** The configurable-module base of the knowledge-sources capability; `isGlobal` is decided by the app root. */
const definition = new ConfigurableModuleBuilder<KnowledgeSourcesOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    KnowledgeSourcesOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: KnowledgeSourcesOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
