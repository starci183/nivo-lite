import { defineCapabilityModule } from "@starci/nest-kit"
import type { ModuleContextVersionsOptions } from "./module-context-versions.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<ModuleContextVersionsOptions>()
