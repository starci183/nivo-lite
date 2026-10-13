import { ConfigurableModuleBuilder } from "@nestjs/common"
import { CHANNEL_PROVISIONING_OPTIONS } from "./channel-provisioning.decorators"
import type { ChannelProvisioningOptions } from "./channel-provisioning.options"

/** The configurable-module base of the provisioning tool. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<ChannelProvisioningOptions>({
    optionsInjectionToken: CHANNEL_PROVISIONING_OPTIONS,
})
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
