/** The tokens Zalo issued for one OA. */
export interface ZaloTokens {
    /** The short-lived access token. */
    readonly accessToken: string
    /** The single-use refresh token. */
    readonly refreshToken: string
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
    "zalo_window_expired" | "zalo_unfollowed" | "zalo_night_hours" | "zalo_token" | "zalo_not_connected" | "zalo_error"
