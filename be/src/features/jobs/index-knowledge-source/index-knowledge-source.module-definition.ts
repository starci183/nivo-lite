import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { IndexKnowledgeSourceOptions } from "./index-knowledge-source.options"

type Host = ConfigurableModuleHost<IndexKnowledgeSourceOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<IndexKnowledgeSourceOptions>()
    .setClassMethodName("register")
    .build()

/** The configurable-module base of the index-knowledge-source module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the index-knowledge-source module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the index-knowledge-source module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
