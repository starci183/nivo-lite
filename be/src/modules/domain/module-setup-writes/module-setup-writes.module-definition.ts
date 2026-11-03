import { defineCapabilityModule } from "@starci/nest-kit"
import type { ModuleSetupWritesOptions } from "./module-setup-writes.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<ModuleSetupWritesOptions>()
