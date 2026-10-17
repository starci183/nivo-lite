import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { N8nPipelinesHttpOptions } from "./n8n-pipelines-http.options"

/** The configurable-module base of the n8n-pipelines-http module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<N8nPipelinesHttpOptions>().setClassMethodName("register").build()
