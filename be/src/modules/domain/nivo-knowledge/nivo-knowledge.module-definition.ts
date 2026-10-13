import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { NivoKnowledgeOptions } from "./nivo-knowledge.options"

/** The configurable-module base of the nivo-knowledge capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<NivoKnowledgeOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
