import { defineCapabilityModule } from "@starci/nest-kit"
import type { ModuleInstallationsOptions } from "./module-installations.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<ModuleInstallationsOptions>()
