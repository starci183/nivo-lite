import { defineCapabilityModule } from "@starci/nest-kit"
import type { AutomationPortsOptions } from "./automation-ports.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<AutomationPortsOptions>()
