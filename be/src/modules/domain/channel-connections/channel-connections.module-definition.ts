import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { ChannelConnectionsOptions } from "./channel-connections.options"

/** The configurable-module base of the channel-connections capability. */
const definition = new ConfigurableModuleBuilder<ChannelConnectionsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    ChannelConnectionsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: ChannelConnectionsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
