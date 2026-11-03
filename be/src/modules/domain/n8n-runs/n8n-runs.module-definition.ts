import { defineCapabilityModule } from "@starci/nest-kit"
import type { N8nRunsOptions } from "./n8n-runs.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<N8nRunsOptions>()
