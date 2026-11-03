import { defineConfigurableModule } from "@starci/nest-kit"
import type { N8nPipelinesApiOptions } from "./n8n-pipelines.options"

/** The configurable-module base of the n8n-pipelines module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<N8nPipelinesApiOptions>()
