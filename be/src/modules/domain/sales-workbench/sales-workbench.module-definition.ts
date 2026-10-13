import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { SalesWorkbenchOptions } from "./sales-workbench.options"

/** The configurable module base of the Sales workbench projection. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<SalesWorkbenchOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
