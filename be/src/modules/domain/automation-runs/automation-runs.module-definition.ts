import { defineCapabilityModule } from "@starci/nest-kit"
import type { AutomationRunsOptions } from "./automation-runs.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<AutomationRunsOptions>()
