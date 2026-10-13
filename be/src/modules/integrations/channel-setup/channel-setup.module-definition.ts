import { ConfigurableModuleBuilder } from "@nestjs/common"
import { CHANNEL_SETUP_OPTIONS } from "./channel-setup.decorators"
import type { ChannelSetupOptions } from "./channel-setup.options"

/** The configurable-module base of the channel-setup integration; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<ChannelSetupOptions>({ optionsInjectionToken: CHANNEL_SETUP_OPTIONS })
        .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
        .build()
