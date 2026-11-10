import { defineCapabilityModule } from "@starci/nest-kit"
import type { LeadMemoryOptions } from "./lead-memory.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<LeadMemoryOptions>()
