import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { SalesOptions } from "./sales.options"

/** The configurable module base of the Sales capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<SalesOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
