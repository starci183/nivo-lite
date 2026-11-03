import { defineConfigurableModule } from "@starci/nest-kit"
import type { N8nPipelinesHttpOptions } from "./n8n-pipelines-http.options"

/** The configurable-module base of the n8n-pipelines-http module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<N8nPipelinesHttpOptions>()
