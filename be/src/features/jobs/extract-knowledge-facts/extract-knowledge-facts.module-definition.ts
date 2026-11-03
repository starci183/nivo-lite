import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { ExtractKnowledgeFactsOptions } from "./extract-knowledge-facts.options"

type Host = ConfigurableModuleHost<ExtractKnowledgeFactsOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<ExtractKnowledgeFactsOptions>()
    .setClassMethodName("register")
    .build()

/** The configurable-module base of the extract-knowledge-facts module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the extract-knowledge-facts module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the extract-knowledge-facts module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
