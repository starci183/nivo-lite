import { defineCapabilityModule } from "@starci/nest-kit"
import type { LeadsOptions } from "./leads.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<LeadsOptions>()
