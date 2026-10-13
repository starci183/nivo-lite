import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ChannelConnectionsOptions } from "./channel-connections.options"

/** The configurable-module base of the channel-connections capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<ChannelConnectionsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
