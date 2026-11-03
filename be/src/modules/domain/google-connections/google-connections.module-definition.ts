import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { GoogleConnectionsOptions } from "./google-connections.options"

/** The configurable-module base of the google-connections capability. */
const definition = new ConfigurableModuleBuilder<GoogleConnectionsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    GoogleConnectionsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: GoogleConnectionsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
