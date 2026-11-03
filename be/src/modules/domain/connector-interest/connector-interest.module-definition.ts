import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { ConnectorInterestOptions } from "./connector-interest.options"

/** Configurable-module base for the connector-interest capability. */
const definition = new ConfigurableModuleBuilder<ConnectorInterestOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    ConnectorInterestOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: ConnectorInterestOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
