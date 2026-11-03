import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { ChannelReceiptsOptions } from "./channel-receipts.options"

/** The configurable-module base of the channel-receipts capability; `isGlobal` is decided by the app root. */
const definition = new ConfigurableModuleBuilder<ChannelReceiptsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    ChannelReceiptsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: ChannelReceiptsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
