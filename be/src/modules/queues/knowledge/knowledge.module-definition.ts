import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { KnowledgeQueueOptions } from "./knowledge.options"

/** The configurable-module base of the knowledge module. */
const definition = new ConfigurableModuleBuilder<KnowledgeQueueOptions>().setClassMethodName("register").build()
export const ConfigurableModuleClass: ConfigurableModuleCls<KnowledgeQueueOptions, "register", "create"> =
    definition.ConfigurableModuleClass
export const MODULE_OPTIONS_TOKEN: string | symbol = definition.MODULE_OPTIONS_TOKEN
export const OPTIONS_TYPE: KnowledgeQueueOptions = definition.OPTIONS_TYPE
