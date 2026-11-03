import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { N8nPipelinesApiOptions } from "./n8n-pipelines.options"

type Host = ConfigurableModuleHost<N8nPipelinesApiOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<N8nPipelinesApiOptions>().setClassMethodName("register").build()

/** The configurable-module base of the n8n-pipelines module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the n8n-pipelines module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the n8n-pipelines module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
