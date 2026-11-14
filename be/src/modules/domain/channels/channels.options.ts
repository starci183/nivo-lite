import type { Type } from "@nestjs/common"
import type { ZaloInboxReads } from "./channels.port"

/** Options of the channels capability. */
export interface ChannelsOptions {
    /** The required origin of the web app, used to build the OAuth return address of a provider. */
    readonly siteUrl: string
    /** The classes behind the ports of the other capabilities. */
    readonly ports: ChannelsPorts
}

/** The classes that implement the ports of the other capabilities. */
export interface ChannelsPorts {
    /** Implements the inbox reads of the Zalo page; an existing provider of the app. */
    readonly inbox: Type<ZaloInboxReads>
}

/** What the environment alone decides; the app root adds the ports. */
export type ChannelsConfig = Omit<ChannelsOptions, "ports">
