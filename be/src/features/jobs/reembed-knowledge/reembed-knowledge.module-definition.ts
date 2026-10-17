import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ReembedKnowledgeOptions } from "./reembed-knowledge.options"

/** The configurable-module base of the reembed-knowledge module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<ReembedKnowledgeOptions>().setClassMethodName("register").build()
