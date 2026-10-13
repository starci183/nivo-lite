import { ConfigurableModuleBuilder } from "@nestjs/common"
import { CONNECTIONS_OPTIONS } from "./connections.decorators"
import type { ConnectionsOptions } from "./connections.options"

/** The configurable-module base of the connections capability. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<ConnectionsOptions>({ optionsInjectionToken: CONNECTIONS_OPTIONS })
        .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
        .build()
