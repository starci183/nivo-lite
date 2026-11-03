import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import { CHANNELS_OPTIONS } from "./channels.decorators"
import type { ChannelsOptions } from "./channels.options"

/** The configurable-module base of the channels capability; `isGlobal` is decided by the app root. */
const definition = new ConfigurableModuleBuilder<ChannelsOptions>({
    optionsInjectionToken: CHANNELS_OPTIONS,
})
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    ChannelsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: ChannelsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
