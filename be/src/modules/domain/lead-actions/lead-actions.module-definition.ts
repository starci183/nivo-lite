import { defineCapabilityModule } from "@starci/nest-kit"
import type { LeadActionsOptions } from "./lead-actions.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<LeadActionsOptions>()
