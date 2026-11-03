import { defineCapabilityModule } from "@starci/nest-kit"
import type { AutomationPipelinesOptions } from "./automation-pipelines.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<AutomationPipelinesOptions>()
