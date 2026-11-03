import { defineCapabilityModule } from "@starci/nest-kit"
import type { N8nHostOptions } from "./n8n-host.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<N8nHostOptions>()
