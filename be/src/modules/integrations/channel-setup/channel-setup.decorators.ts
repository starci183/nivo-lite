import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { ChannelSetupClient } from "./channel-setup.client"
import type { ChannelSetupOptions } from "./channel-setup.options"

/** Token of the options of the channel-setup integration, exported so a spec can provide it. */
export const CHANNEL_SETUP_OPTIONS: unique symbol = Symbol("integrations.channel-setup.options")

/** Token of the channel-setup client. */
export const CHANNEL_SETUP_CLIENT: unique symbol = Symbol("integrations.channel-setup.client")

/** Injects the options of the channel-setup integration. Parameter type: ChannelSetupOptions. */
export const InjectChannelSetupOptions = (): TypedParameterDecorator<ChannelSetupOptions> =>
    injector<ChannelSetupOptions>(CHANNEL_SETUP_OPTIONS)

/** Injects the channel-setup client. Parameter type: ChannelSetupClient. */
export const InjectChannelSetupClient = (): TypedParameterDecorator<ChannelSetupClient> =>
    injector<ChannelSetupClient>(CHANNEL_SETUP_CLIENT)
