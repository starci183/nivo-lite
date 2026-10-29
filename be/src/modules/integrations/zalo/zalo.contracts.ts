/** The form and answer field name OAuth 2.0 (RFC 6749) mandates for the long-lived provider renewal credential. */
export const RENEWAL_GRANT_FIELD = "refresh_token"

/** The tokens Zalo issued for one OA. */
export interface ZaloTokens {
    /** The short-lived access token. */
    readonly accessToken: string
    /** The single-use provider renewal token (not a session token). */
    readonly renewalToken: string
    /** How long the access token lives, in seconds. */
    readonly expiresInSeconds: number
}

/** One party of a Zalo event. */
export interface ZaloParty {
    /** The party's Zalo id. */
    readonly id?: string
}

/** The message of a Zalo event. */
export interface ZaloMessage {
    /** Zalo's id of the message. */
    readonly msg_id?: string
    /** What the customer wrote. */
    readonly text?: string
}

/** The event Zalo posts to the webhook of an OA; only the fields the intake reads. */
export interface ZaloEvent {
    /** The app the event was sent for. */
    readonly app_id?: string
    /** The event name, for example `user_send_text`. */
    readonly event_name?: string
    /** The event time. */
    readonly timestamp?: string | number
    /** Who wrote. */
    readonly sender?: ZaloParty
    /** The OA that received it. */
    readonly recipient?: ZaloParty
    /** The message the customer wrote. */
    readonly message?: ZaloMessage
}

/** Why a consultation message could not be delivered, in terms the workbench can show. */
export type ZaloFailure =
    | "zalo_window_expired"
    | "zalo_unfollowed"
    | "zalo_night_hours"
    | "zalo_token"
    | "zalo_not_connected"
    | "zalo_recipient"
    | "zalo_template"
    | "zalo_quota"
    | "zalo_not_permitted"
    | "zalo_error"

/** One Zalo Notification Service (ZNS) message: an approved template filled for one phone. */
export interface ZnsMessage {
    /** The recipient's phone in the international form without a plus, e.g. 84912345678. */
    readonly phone: string
    /** The id of the approved ZNS template. */
    readonly templateId: string
    /** The template parameters by the names the template declares. */
    readonly templateData: Readonly<Record<string, string | number>>
    /** The sender's own id for the message, echoed back by Zalo; at most 48 characters. */
    readonly trackingId: string
}

/** What Zalo answered for a sent ZNS message. */
export interface ZnsReceipt {
    /** Zalo's id of the message, or an empty text when it gave none. */
    readonly messageId: string
}

/** One OA article to create. */
export interface ZaloArticle {
    /** The title (150 characters at most). */
    readonly title: string
    /** The author shown (50 characters at most). */
    readonly author: string
    /** The public https url of the cover photo. */
    readonly coverUrl: string
    /** The short description (300 characters at most). */
    readonly description: string
    /** The body, one text paragraph per entry. */
    readonly paragraphs: ReadonlyArray<string>
    /** True to show it right away, false to keep it hidden (draft). */
    readonly publish: boolean
}

/** One OA article as the article list reports it, with what Zalo counted for it. */
export interface ZaloArticleStats {
    /** The article id. */
    readonly id: string
    /** The title. */
    readonly title: string
    /** `show` (published) or `hide`. */
    readonly status: string
    /** When it was created, ISO 8601. */
    readonly createdAt: string
    /** How many times it was viewed. */
    readonly views: number
    /** How many times it was shared. */
    readonly shares: number
}
