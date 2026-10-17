import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { N8nPipelinesApiOptions } from "./n8n-pipelines.options"

/** The configurable-module base of the n8n-pipelines module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<N8nPipelinesApiOptions>().setClassMethodName("register").build()
