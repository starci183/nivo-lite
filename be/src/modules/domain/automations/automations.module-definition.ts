import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { AutomationsOptions } from "./automations.options"

/** The configurable-module base of the automations capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<AutomationsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
