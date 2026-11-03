import { defineCapabilityModule } from "@starci/nest-kit"
import type { LeadViewsOptions } from "./lead-views.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<LeadViewsOptions>()
