import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ModuleOpsOptions } from "./module-ops.options"

/** The configurable-module base of the module-ops capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<ModuleOpsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
