import type { Type } from "@nestjs/common"
import type { ZaloAccessTokens } from "./zalo-access-tokens.port"

/** The zalo-provider capability: the rules of the poll that reads back the messages the webhook never delivered, and the ports it reads through. */
export interface ZaloProviderOptions {
    /** How long after the customer's last message the OA may still reply as a consultation message (Zalo's rule: 48 hours), in milliseconds. */
    readonly replyWindowMs?: number
    /** A polled message older than this is kept for the owner instead of being answered by an agent, in milliseconds. */
    readonly staleAfterMs?: number
    /** The classes behind the ports of the other capabilities. */
    readonly ports: ZaloProviderPorts
}

/** The classes that implement the ports the provider reads through. */
export interface ZaloProviderPorts {
    /** Implements the access tokens of the Zalo connections; an existing provider of the app. */
    readonly tokens: Type<ZaloAccessTokens>
}

/** What the environment alone decides; the app root adds the ports. */
export type ZaloProviderConfig = Omit<ZaloProviderOptions, "ports">
