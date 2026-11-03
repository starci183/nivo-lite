import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import { CHANNEL_PROVISIONING_OPTIONS } from "./channel-provisioning.decorators"
import type { ChannelProvisioningOptions } from "./channel-provisioning.options"

/** The configurable-module base of the provisioning tool. */
const definition = new ConfigurableModuleBuilder<ChannelProvisioningOptions>({
    optionsInjectionToken: CHANNEL_PROVISIONING_OPTIONS,
})
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    ChannelProvisioningOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: ChannelProvisioningOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
