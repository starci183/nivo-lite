import { defineCapabilityModule } from "@starci/nest-kit"
import type { LeadFreezesOptions } from "./lead-freezes.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<LeadFreezesOptions>()
