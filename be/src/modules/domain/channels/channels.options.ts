import type { InjectionToken, Type } from "@nestjs/common"
import type { ZaloInboxReads } from "./channels.port"

/** Options of the channels capability. */
export interface ChannelsOptions {
    /** The required origin of the web app, used to build the OAuth return address of a provider. */
    readonly siteUrl: string
    /** The classes behind the ports of the other capabilities. */
    readonly ports: ChannelsPorts
    /** Provider token of an Image implementation: it crops the photos of a collage and draws the page. */
    readonly image: InjectionToken
    /** Provider token of a StorageAssetsPort implementation: where the collage of several photos is kept. */
    readonly storage: InjectionToken
    /** The public origin of the API, where a stored collage is read by the channels; absent or empty, no collage is built and the photos go one by one. */
    readonly publicApiUrl?: string | undefined
}

/** The classes that implement the ports of the other capabilities. */
export interface ChannelsPorts {
    /** Implements the inbox reads of the Zalo page; an existing provider of the app. */
    readonly inbox: Type<ZaloInboxReads>
}

/** What the environment alone decides; the app root adds the ports, the storage and the public address. */
export type ChannelsConfig = Omit<ChannelsOptions, "ports" | "image" | "storage" | "publicApiUrl">
