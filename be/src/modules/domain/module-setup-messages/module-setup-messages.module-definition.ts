import { defineCapabilityModule } from "@starci/nest-kit"
import type { ModuleSetupMessagesOptions } from "./module-setup-messages.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<ModuleSetupMessagesOptions>()
