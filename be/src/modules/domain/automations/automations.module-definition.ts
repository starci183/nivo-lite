import { defineCapabilityModule } from "@starci/nest-kit"
import type { AutomationsOptions } from "./automations.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<AutomationsOptions>()
