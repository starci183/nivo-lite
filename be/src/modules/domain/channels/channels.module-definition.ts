import { defineCapabilityModule } from "@starci/nest-kit"
import { CHANNELS_OPTIONS } from "./channels.decorators"
import type { ChannelsOptions } from "./channels.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<ChannelsOptions>({
    optionsInjectionToken: CHANNELS_OPTIONS,
})
