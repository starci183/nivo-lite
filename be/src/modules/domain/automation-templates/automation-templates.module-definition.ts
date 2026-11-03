import { defineCapabilityModule } from "@starci/nest-kit"
import type { AutomationTemplatesOptions } from "./automation-templates.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<AutomationTemplatesOptions>()
