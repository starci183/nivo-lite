import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { AutomationPortsOptions } from "./automation-ports.options"

/** The configurable-module base of the automation ports. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<AutomationPortsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
