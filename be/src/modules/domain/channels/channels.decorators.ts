import { injector, type TypedParameterDecorator } from "@modules/platform/composition"
import type { ZaloInboxReads } from "./channels.port"
import type { ChannelsConfig } from "./channels.options"

/** Token of the options of the channels capability, exported so a spec can provide it. */
export const CHANNELS_OPTIONS: unique symbol = Symbol("domain.channels.options")

/** Injects the options of the channels capability. Parameter type: ChannelsConfig (the env part; ports are bound separately). */
export const InjectChannelsOptions = (): TypedParameterDecorator<ChannelsConfig> =>
    injector<ChannelsConfig>(CHANNELS_OPTIONS)

/** Token of the Zalo inbox reads port (zalo-inbox capability). */
export const ZALO_INBOX_READS: unique symbol = Symbol("domain.channels.zalo-inbox-reads")

/** Injects the Zalo inbox reads port. Parameter type: ZaloInboxReads. */
export const InjectZaloInboxReads = (): TypedParameterDecorator<ZaloInboxReads> =>
    injector<ZaloInboxReads>(ZALO_INBOX_READS)
