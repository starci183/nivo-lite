import { defineCapabilityModule } from "@starci/nest-kit"
import type { LeadFlowsOptions } from "./lead-flows.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<LeadFlowsOptions>()
