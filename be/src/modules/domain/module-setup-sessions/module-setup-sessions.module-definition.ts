import { defineCapabilityModule } from "@starci/nest-kit"
import type { ModuleSetupSessionsOptions } from "./module-setup-sessions.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<ModuleSetupSessionsOptions>()
