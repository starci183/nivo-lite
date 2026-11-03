import { defineCapabilityModule } from "@starci/nest-kit"
import type { ModuleOpsOptions } from "./module-ops.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<ModuleOpsOptions>()
