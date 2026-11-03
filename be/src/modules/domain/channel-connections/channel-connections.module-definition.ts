import { defineCapabilityModule } from "@starci/nest-kit"
import type { ChannelConnectionsOptions } from "./channel-connections.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<ChannelConnectionsOptions>()
