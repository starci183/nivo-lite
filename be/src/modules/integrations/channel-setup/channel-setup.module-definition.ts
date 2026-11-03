import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import { CHANNEL_SETUP_OPTIONS } from "./channel-setup.decorators"
import type { ChannelSetupOptions } from "./channel-setup.options"

/** The configurable-module base of the channel-setup integration; `isGlobal` is decided by the app root. */
const definition = new ConfigurableModuleBuilder<ChannelSetupOptions>({ optionsInjectionToken: CHANNEL_SETUP_OPTIONS })
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    ChannelSetupOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const MODULE_OPTIONS_TOKEN: string | symbol = definition.MODULE_OPTIONS_TOKEN
export const OPTIONS_TYPE: ChannelSetupOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
