import { defineConfigurableModule } from "@starci/nest-kit"
import type { N8nQueueOptions } from "./n8n.options"

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<N8nQueueOptions>()
