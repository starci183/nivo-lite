import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConnectorInterestOptions } from "./connector-interest.options"

/** Configurable-module base for the connector-interest capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<ConnectorInterestOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
