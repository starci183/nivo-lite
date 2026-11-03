import { defineCapabilityModule } from "@starci/nest-kit"
import { CHANNEL_PROVISIONING_OPTIONS } from "./channel-provisioning.decorators"
import type { ChannelProvisioningOptions } from "./channel-provisioning.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<ChannelProvisioningOptions>({
    optionsInjectionToken: CHANNEL_PROVISIONING_OPTIONS,
})
