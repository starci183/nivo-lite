import type { ZaloFailure } from "@modules/integrations/zalo"
import type { ConversationTarget } from "@modules/domain/agent-conversations"

/** A started Zalo authorization. */
export interface ZaloPkce {
    /** The PKCE code verifier. */
    readonly verifier: string
    /** The one-time nonce the return must carry. */
    readonly nonce: string
    /** When the nonce stops working, epoch milliseconds. */
    readonly exp: number
}

/** The Zalo OA credential: one sealed JSON document of the connection secret. */
export interface ZaloSecret {
    /** The Zalo app id. */
    readonly appId: string
    /** The Zalo app secret. */
    readonly appSecret: string
    /** The "OA Secret Key" of the app's webhook settings; it signs every webhook and is not the app secret. */
    readonly oaSecret: string
    /** The current access token, after authorization. */
    readonly accessToken?: string
    /** The single-use refresh token. */
    readonly refreshToken?: string
    /** When the refresh token stops working, ISO 8601. */
    readonly refreshExpiresAt?: string
    /** A started authorization: the PKCE verifier and the one-time state nonce. */
    readonly pkce?: ZaloPkce
}

/** The Zalo credential together with the facts of its connection row. */
export interface LoadedZalo {
    /** The credential. */
    readonly secret: ZaloSecret
    /** When the access token ends, epoch milliseconds, or null. */
    readonly expiresAt: number | null
    /** The workspace of the connection. */
    readonly workspaceId: string
}

/** What the owner opens to grant the OA permissions. */
export interface ZaloAuthorization {
    /** The Zalo permission page. */
    readonly url: string
    /** The address Zalo returns the browser to; it must be registered on the Zalo app. */
    readonly callbackUrl: string
}

/** What Zalo sends the browser back with after the owner granted the OA permissions. */
export interface ZaloReturn {
    /** The state the authorization started with: the connection id and the one-time nonce. */
    readonly state: string
    /** The authorization code to exchange for tokens. */
    readonly code: string
    /** The OA id Zalo reports, when it does. */
    readonly oaId?: string | undefined
}

/** How a caller asks for an access token. */
export interface TokenWish {
    /** A token Zalo just rejected: renew even when its clock says it is fine. */
    readonly stale?: string
    /** Renew whatever the clock says. */
    readonly force?: boolean
}

/** How many Zalo connections a scheduled refresh touched. */
export interface ZaloRefreshSummary {
    /** Connections whose tokens were renewed. */
    readonly refreshed: number
    /** Connections whose renewal failed. */
    readonly failed: number
}

/** One reply to push to the customer's own channel. */
export interface DeliveryRequest {
    /** The conversation the reply belongs to. */
    readonly conversationId: string
    /** The stored agent message that carries the text, so the verdict lands on it. */
    readonly messageId: string
    /** The text to send. */
    readonly text: string
}

/** The outcome of a delivery: whether the channel accepted it and, if not, why. */
export interface DeliveryResult {
    /** True only when the channel accepted the message. */
    readonly delivered: boolean
    /** Why a Zalo message was not delivered; null otherwise. */
    readonly failure: ZaloFailure | null
}

/** Sends a reply on channels this capability does not own (Facebook, Instagram); the owner registers it once at start. */
export interface ChannelSender {
    /** The conversation channel keys it sends for. */
    readonly channels: ReadonlyArray<string>
    /** Pushes the text to the customer; false when the channel did not accept it. Never throws. */
    send(conversation: ConversationTarget, text: string): Promise<boolean>
}

/** A sender, or none: the answer of the registry. */
export type RegisteredSender = ChannelSender | undefined

/** Where an owner registers a sender for its channels. */
export interface ChannelSenderRegistry {
    /** Registers a sender; the channels it names are served by it. */
    add(sender: ChannelSender): void
    /** The sender serving a channel, or undefined. */
    get(channel: string): RegisteredSender
}

/** What the health check concluded about one connection. */
export interface HealthVerdict {
    /** ok, silent or failing. */
    readonly state: "ok" | "silent" | "failing"
    /** Why, in a short sentence; empty for ok. */
    readonly reason: string
}

/** How many connections a health check saw in each state. */
export interface HealthSummary {
    /** Connections judged. */
    readonly checked: number
    /** Connections fine. */
    readonly ok: number
    /** Connections that went silent. */
    readonly silent: number
    /** Connections that are failing. */
    readonly failing: number
    /** Connections whose recorded verdict changed. */
    readonly changed: number
}

/** The running count of a health check. */
export interface HealthTally {
    /** Connections judged. */
    checked: number
    /** Connections fine. */
    ok: number
    /** Connections that went silent. */
    silent: number
    /** Connections that are failing. */
    failing: number
    /** Connections whose recorded verdict changed. */
    changed: number
}
