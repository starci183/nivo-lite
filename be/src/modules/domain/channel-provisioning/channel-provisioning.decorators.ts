import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { ChannelProvisioningOptions } from "./channel-provisioning.options"

/** Token of the provisioning options, exported so a spec can provide it. */
export const CHANNEL_PROVISIONING_OPTIONS: unique symbol = Symbol("domain.channel-provisioning.options")

/** Injects the options of the provisioning tool. Parameter type: ChannelProvisioningOptions. */
export const InjectChannelProvisioningOptions = (): TypedParameterDecorator<ChannelProvisioningOptions> =>
    injector<ChannelProvisioningOptions>(CHANNEL_PROVISIONING_OPTIONS)
