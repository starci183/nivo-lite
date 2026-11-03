import { defineCapabilityModule } from "@starci/nest-kit"
import type { N8nOptions } from "./n8n.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<N8nOptions>()
