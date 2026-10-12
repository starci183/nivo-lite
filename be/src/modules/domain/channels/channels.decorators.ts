import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { ChannelSenderRegistry } from "./channels.contracts"
import type { ChannelsOptions } from "./channels.options"

/** Token of the options of the channels capability, exported so a spec can provide it. */
export const CHANNELS_OPTIONS: unique symbol = Symbol("domain.channels.options")

/** Token of the registry of senders for channels this capability does not own. */
export const CHANNEL_SENDER_REGISTRY: unique symbol = Symbol("domain.channels.sender-registry")

/** Injects the options of the channels capability. Parameter type: ChannelsOptions. */
export const InjectChannelsOptions = (): TypedParameterDecorator<ChannelsOptions> =>
    injector<ChannelsOptions>(CHANNELS_OPTIONS)

/** Injects the registry an owner adds the sender of its channels to. Parameter type: ChannelSenderRegistry. */
export const InjectChannelSenderRegistry = (): TypedParameterDecorator<ChannelSenderRegistry> =>
    injector<ChannelSenderRegistry>(CHANNEL_SENDER_REGISTRY)
