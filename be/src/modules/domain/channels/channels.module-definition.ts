import { ConfigurableModuleBuilder } from "@nestjs/common"
import { CHANNELS_OPTIONS } from "./channels.decorators"
import type { ChannelsOptions } from "./channels.options"

/** The configurable-module base of the channels capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<ChannelsOptions>({
    optionsInjectionToken: CHANNELS_OPTIONS,
})
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
