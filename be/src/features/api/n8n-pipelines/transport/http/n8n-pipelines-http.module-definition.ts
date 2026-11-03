import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { N8nPipelinesHttpOptions } from "./n8n-pipelines-http.options"

type Host = ConfigurableModuleHost<N8nPipelinesHttpOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<N8nPipelinesHttpOptions>().setClassMethodName("register").build()

/** The configurable-module base of the n8n-pipelines-http module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the n8n-pipelines-http module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the n8n-pipelines-http module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
