import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ChannelReceiptsOptions } from "./channel-receipts.options"

/** The configurable-module base of the channel-receipts capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<ChannelReceiptsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
