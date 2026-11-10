import type { Image } from "@modules/integrations/image"
import type { StorageAssetsPort } from "@modules/integrations/object-storage"
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

/** Token of the file store the collage is kept in, selected by the app root. */
export const CHANNELS_COLLAGE_STORAGE: unique symbol = Symbol("domain.channels.collage-storage")

/** Injects the file store of the collage. Parameter type: StorageAssetsPort. */
export const InjectChannelsCollageStorage = (): TypedParameterDecorator<StorageAssetsPort> =>
    injector<StorageAssetsPort>(CHANNELS_COLLAGE_STORAGE)

/** Token of the public origin of the API, an empty text when it has none. */
export const CHANNELS_PUBLIC_API_URL: unique symbol = Symbol("domain.channels.public-api-url")

/** Injects the public origin of the API, or an empty text. Parameter type: string. */
export const InjectChannelsPublicApiUrl = (): TypedParameterDecorator<string> =>
    injector<string>(CHANNELS_PUBLIC_API_URL)

/** Token of the image door the collage is drawn with, selected by the app root. */
export const CHANNELS_IMAGE: unique symbol = Symbol("domain.channels.image")

/** Injects the image door of the collage. Parameter type: Image. */
export const InjectChannelsImage = (): TypedParameterDecorator<Image> => injector<Image>(CHANNELS_IMAGE)
