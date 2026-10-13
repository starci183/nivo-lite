/** The permissions asked at login (Facebook Login for Business, or the classic dialog when no configuration id is set). */
export const META_SCOPES: ReadonlyArray<string> = [
    "pages_show_list",
    "pages_manage_metadata",
    "pages_messaging",
    "pages_read_engagement",
    "pages_manage_engagement",
    "leads_retrieval",
    "instagram_basic",
    "instagram_manage_messages",
    "instagram_manage_comments",
    "business_management",
]

/** Page webhook fields the Page is subscribed to (POST /{page-id}/subscribed_apps). */
export const PAGE_FIELDS: ReadonlyArray<string> = ["messages", "messaging_postbacks", "feed", "leadgen"]

/** Instagram webhook fields (app-level subscription of the `instagram` object; `messages` also needs the Page subscribed). */
export const INSTAGRAM_FIELDS: ReadonlyArray<string> = ["messages", "comments", "mentions"]

/** The purpose a signed Meta OAuth state carries. */
export const META_STATE_PURPOSE = "meta"

/** One hour in milliseconds. */
export const HOUR_MS = 3_600_000

/** Standard messaging: a Page may answer within 24 hours of the person's last message. */
export const STANDARD_WINDOW_MS = 24 * HOUR_MS

/** The HUMAN_AGENT tag extends that to 7 days, for a real person's reply only. */
export const HUMAN_AGENT_WINDOW_MS = 7 * 24 * HOUR_MS

/** A private reply to a comment must be sent within 7 days of the comment, once per comment. */
export const PRIVATE_REPLY_WINDOW_MS = 7 * 24 * HOUR_MS

/** Messenger text messages are limited to 2000 characters. */
export const MESSENGER_MAX_CHARS = 2000

/** Instagram text messages are limited to 1000 bytes (UTF-8). */
export const INSTAGRAM_MAX_BYTES = 1000

/** Which Meta surface an event or a send belongs to. */
export type MetaPlatform = "facebook" | "instagram"

/** What a normalised webhook event is. */
export type MetaEventKind = "dm" | "comment" | "leadgen" | "mention" | "postback"

/** The ad referral a conversation can start from. */
export interface MetaReferral {
    /** The ref parameter. */
    readonly ref: string | null
    /** The referral source. */
    readonly source: string | null
    /** The referral type. */
    readonly type: string | null
    /** The ad id. */
    readonly ad_id: string | null
}

/** One normalised webhook event. */
export interface MetaEvent {
    /** What happened. */
    readonly kind: MetaEventKind
    /** Facebook or Instagram. */
    readonly platform: MetaPlatform
    /** The Page the event belongs to (Facebook events; null on Instagram events). */
    readonly page_id: string | null
    /** The Instagram account the event belongs to (Instagram events). */
    readonly ig_id: string | null
    /** Page-scoped id of the person (Facebook). */
    readonly sender_psid: string | null
    /** Instagram-scoped id of the person (Instagram). */
    readonly sender_igsid: string | null
    /** The display name when the payload carries one. */
    readonly sender_name: string | null
    /** The text, title or payload of the message. */
    readonly text: string | null
    /** The comment id for comments and mentions. */
    readonly comment_id: string | null
    /** The post id for comments and mentions. */
    readonly post_id: string | null
    /** The lead id for lead ads. */
    readonly leadgen_id: string | null
    /** The lead form id. */
    readonly form_id: string | null
    /** The ad id. */
    readonly ad_id: string | null
    /** The referral, when the conversation came from an ad or a link. */
    readonly referral: MetaReferral | null
    /** The postback or quick reply payload. */
    readonly postback_payload: string | null
    /** The message id. */
    readonly mid: string | null
    /** Milliseconds since the epoch. */
    readonly timestamp: number
    /** Stable per event: the idempotency key (Meta redelivers). */
    readonly event_key: string
}

/** The contact and the answers of one lead-form submission. */
export interface MetaLead {
    /** The person's name. */
    readonly name: string | null
    /** The phone number, digits and a leading plus. */
    readonly phone: string | null
    /** The email address. */
    readonly email: string | null
    /** Every answer, by the form question's key. */
    readonly fields: Readonly<Record<string, string>>
    /** The ad id. */
    readonly ad_id: string | null
    /** The form id. */
    readonly form_id: string | null
    /** When the lead was created, as Meta writes it. */
    readonly created_at: string | null
}

/** A tag that lets a real person answer after the standard window. */
export type MessageTag = "HUMAN_AGENT"

/** Whether a Page may message a person now. */
export type WindowVerdict =
    | { readonly ok: true; readonly via: "standard" | "human_agent" }
    | { readonly ok: false; readonly reason: "no_user_message" | "window_expired" | "human_agent_expired" }

/** Whether a private reply to a comment may be sent now. */
export type PrivateReplyVerdict =
    | { readonly ok: true }
    | { readonly ok: false; readonly reason: "already_replied" | "comment_age_unknown" | "private_reply_expired" }

/** Why a Meta operation did not happen; a refusal of the platform rules or the classification of a Graph error. */
export type MetaFailure =
    | "window_expired"
    | "no_user_message"
    | "human_agent_expired"
    | "already_replied"
    | "comment_age_unknown"
    | "private_reply_expired"
    | "rate_limited"
    | "token"
    | "permission"
    | "not_found"
    | "recipient_unavailable"
    | "empty_text"
    | "not_connected"
    | "error"

/** A Page the user manages, with its own token and the linked Instagram professional account. */
export interface MetaPageChoice {
    /** The Page id. */
    readonly id: string
    /** The Page name. */
    readonly name: string
    /** The Page category. */
    readonly category: string | null
    /** The Page access token. */
    readonly token: string
    /** The linked Instagram professional account, when there is one. */
    readonly ig: {
        /** The Instagram account id. */
        readonly id: string
        /** The username. */
        readonly username: string | null
        /** The display name. */
        readonly name: string | null
    } | null
}

/** A chosen Page and what a send needs to act as it. */
export interface MetaPageAccess {
    /** The connection the Page belongs to (the rate limit key is the page id). */
    readonly pageId: string
    /** The Page access token. */
    readonly pageToken: string
    /** The linked Instagram account id, when there is one. */
    readonly igId: string | null
}

/** What a send answered: the message ids, or the reason it did not go. */
export type SendResult =
    | {
          readonly ok: true
          readonly ids: ReadonlyArray<string>
          /** A private reply: the PSID / IGSID of the commenter the message reached. */
          readonly recipientId?: string
      }
    | { readonly ok: false; readonly reason: MetaFailure; readonly detail?: string }

/** One object of the app-level webhook subscription. */
export interface AppObject {
    /** The callback url Meta has. */
    readonly callbackUrl: string
    /** The fields subscribed. */
    readonly fields: ReadonlyArray<string>
    /** Wanted fields that are missing. */
    readonly missing: ReadonlyArray<string>
    /** Whether the callback url is the one this deployment serves. */
    readonly urlMatches: boolean
}

/** What Meta really has: the Page subscription and the app subscription. */
export interface MetaSubscriptionStatus {
    /** The Page is subscribed to the app, and which fields. */
    readonly page: {
        /** Whether the app is subscribed to the Page. */
        readonly subscribed: boolean
        /** The fields subscribed. */
        readonly fields: ReadonlyArray<string>
        /** Wanted fields that are missing. */
        readonly missing: ReadonlyArray<string>
    }
    /** The app's own webhook subscription per object; null when it could not be read. */
    readonly app: {
        /** The `page` object. */
        readonly page: AppObject | null
        /** The `instagram` object. */
        readonly instagram: AppObject | null
    } | null
}

/** What `ensureAppSubscriptions` did. */
export interface AppSubscriptionResult {
    /** True when both objects were pointed at this deployment's webhook. */
    readonly done: boolean
    /** Why nothing was done. */
    readonly reason?: "local" | "not_configured" | "no_verify_token"
}

/** A rate limiter that keeps a sliding window per key. */
export interface RateLimiter {
    /** Takes one hit for `key` at `now`; false when the window is full. */
    take(key: string, now: number): boolean
}

/** What a verified OAuth state carries (the same scheme as the google connection, a different key). */
export interface MetaState {
    /** The workspace. */
    readonly w: string
    /** The user. */
    readonly u: string
    /** The same-site return path. */
    readonly r: string
    /** The expiry instant. */
    readonly e: number
    /** The purpose. */
    readonly p?: string
}

/** What a caller signs into a Meta state. */
export interface MetaStateInput {
    /** The workspace. */
    readonly workspaceId: string
    /** The user. */
    readonly userId: string
    /** The path to return to. */
    readonly returnTo: string
}
