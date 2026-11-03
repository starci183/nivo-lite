import { defineCapabilityModule } from "@starci/nest-kit"
import type { AutomationCommandsOptions } from "./automation-commands.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<AutomationCommandsOptions>()
