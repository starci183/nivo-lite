import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { ChannelSenderRegistry } from "./channels.contracts"
import type { ZaloInboxReads } from "./channels.port"
import type { ChannelsConfig } from "./channels.options"

/** Token of the options of the channels capability, exported so a spec can provide it. */
export const CHANNELS_OPTIONS: unique symbol = Symbol("domain.channels.options")

/** Token of the registry of senders for channels this capability does not own. */
export const CHANNEL_SENDER_REGISTRY: unique symbol = Symbol("domain.channels.sender-registry")

/** Injects the options of the channels capability. Parameter type: ChannelsConfig (the env part; ports are bound separately). */
export const InjectChannelsOptions = (): TypedParameterDecorator<ChannelsConfig> =>
    injector<ChannelsConfig>(CHANNELS_OPTIONS)

/** Injects the registry an owner adds the sender of its channels to. Parameter type: ChannelSenderRegistry. */
export const InjectChannelSenderRegistry = (): TypedParameterDecorator<ChannelSenderRegistry> =>
    injector<ChannelSenderRegistry>(CHANNEL_SENDER_REGISTRY)

/** Token of the Zalo inbox reads port (zalo-inbox capability). */
export const ZALO_INBOX_READS: unique symbol = Symbol("domain.channels.zalo-inbox-reads")

/** Injects the Zalo inbox reads port. Parameter type: ZaloInboxReads. */
export const InjectZaloInboxReads = (): TypedParameterDecorator<ZaloInboxReads> =>
    injector<ZaloInboxReads>(ZALO_INBOX_READS)
