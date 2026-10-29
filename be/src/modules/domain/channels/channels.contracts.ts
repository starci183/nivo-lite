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
    readonly accessToken?: string | undefined
    /** The single-use refresh token. */
    readonly renewalToken?: string | undefined
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

/** One text to a person (a staff member) on a connection, outside any conversation. */
export interface PersonMessage {
    /** The workspace that sends. */
    readonly workspaceId: string
    /** The connection it leaves through. */
    readonly connectionId: string
    /** The provider of the connection. */
    readonly provider: "telegram" | "zalo_oa"
    /** The Telegram chat id or the Zalo user id. */
    readonly recipientId: string
    /** The text. */
    readonly text: string
}

/** The facts of a renewal notice, the values a ZNS renewal template is filled with. */
export interface RenewalNoticeFields {
    /** The customer's name as the invoice names them. */
    readonly customerName: string
    /** The plan or service being renewed. */
    readonly plan: string
    /** The day the current term ends, ISO `YYYY-MM-DD`; ZNS receives it as `dd/MM/yyyy`. */
    readonly endDate: string
    /** The amount to pay, in whole dong. */
    readonly amount: number
    /** The bank transfer content that matches the payment to the invoice. */
    readonly transferContent: string
    /** The invoice number, e.g. INV-202610-0001. */
    readonly invoiceNumber: string
}

/** A structured renewal notice riding with the text: what lets Zalo reach the customer by ZNS when the chat window is closed. */
export interface RenewalNotification {
    /** The kind of notice; it picks the workspace's ZNS template. */
    readonly kind: "renewal"
    /** The customer's phone from the lead or customer record, in any common Vietnamese form, or null when there is none. */
    readonly phone: string | null
    /** The values of the template. */
    readonly fields: RenewalNoticeFields
}

/** One reply to push to the customer's own channel. */
export interface DeliveryRequest {
    /** The conversation the reply belongs to. */
    readonly conversationId: string
    /** The stored agent message that carries the text, so the verdict lands on it. */
    readonly messageId: string
    /** The text to send. */
    readonly text: string
    /** The structured notice behind the text, when there is one: on Zalo it allows the ZNS fallback outside the 48-hour window. */
    readonly notification?: RenewalNotification
}

/** Which Zalo route carried a delivered message. */
export type DeliveryRoute = "consultation" | "zns"

/**
 * A fact about a delivery worth telling the owner: the QR image did not follow the text (the link in the text still works), or why a
 * closed Zalo window could not fall back to ZNS.
 */
export type DeliveryNote = "qr_image_failed" | "zns_not_configured" | "zns_no_phone"

/** The outcome of a delivery: whether the channel accepted it and, if not, why. */
export interface DeliveryResult {
    /** True only when the channel accepted the message. */
    readonly delivered: boolean
    /** Why a Zalo message was not delivered; null otherwise. */
    readonly failure: ZaloFailure | null
    /** The Zalo route that carried it, when it went over Zalo. */
    readonly via?: DeliveryRoute
    /** A fact worth showing next to the verdict, when there is one. */
    readonly note?: DeliveryNote
}

/** The parameter names a workspace's ZNS renewal template declares, per field; an empty name leaves that field out. */
export interface ZnsRenewalParams {
    /** The parameter of the customer's name. */
    readonly customerName: string
    /** The parameter of the plan. */
    readonly plan: string
    /** The parameter of the term's end date. */
    readonly endDate: string
    /** The parameter of the amount. */
    readonly amount: string
    /** The parameter of the transfer content. */
    readonly transferContent: string
    /** The parameter of the invoice number. */
    readonly invoiceNumber: string
}

/** The ZNS renewal template a Zalo OA connection uses outside the 48-hour window. */
export interface ZnsRenewalSettings {
    /** The approved ZNS template id; empty when none is configured. */
    readonly templateId: string
    /** The parameter names of the template. */
    readonly params: ZnsRenewalParams
}

/** The ZNS renewal settings of a connection, or null when no template is configured. */
export type OptionalZnsRenewal = ZnsRenewalSettings | null

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
