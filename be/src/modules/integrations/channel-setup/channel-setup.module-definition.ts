import { defineCapabilityModule } from "@starci/nest-kit"
import { CHANNEL_SETUP_OPTIONS } from "./channel-setup.decorators"
import type { ChannelSetupOptions } from "./channel-setup.options"

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineCapabilityModule<ChannelSetupOptions>({
        optionsInjectionToken: CHANNEL_SETUP_OPTIONS,
    })
