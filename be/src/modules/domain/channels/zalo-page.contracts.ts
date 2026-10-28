/** Where the OA access token stands. */
export type ZaloTokenState = "none" | "valid" | "renewable" | "expired"

/** The verdict of one row of the check list. */
export type ZaloCheckState = "ok" | "fail" | "warn"

/** The parts of a Zalo OA connection the check list names. */
export type ZaloCheckKey = "app" | "token" | "webhook" | "permissions"

/** What the OA access token looks like to the owner; no token is ever returned. */
export interface ZaloAccessView {
    /** Where it stands. */
    readonly state: ZaloTokenState
    /** When the access token ends, ISO 8601, or null before any authorization. */
    readonly expiresAt: string | null
    /** Whole minutes since the access token ended, or null while it is alive or absent. */
    readonly expiredMinutesAgo: number | null
    /** True when a live refresh token can still renew the access token. */
    readonly canRefresh: boolean
}

/** One row of the check list: a verdict and the code the page words it with. */
export interface ZaloCheckRow {
    /** The part checked. */
    readonly key: ZaloCheckKey
    /** The verdict. */
    readonly state: ZaloCheckState
    /** What the detail line says; the page owns the wording. */
    readonly code: string
    /** The time the detail refers to, ISO 8601, when it has one. */
    readonly at: string | null
    /** Names the detail lists (the events seen, the permissions missing). */
    readonly names: ReadonlyArray<string>
}

/** A follower who wrote to the OA inside the free 48 hours and can be sent a test message. */
export interface ZaloRecipient {
    /** The Zalo user id. */
    readonly userId: string
    /** The name Zalo gave, or an empty text. */
    readonly name: string
    /** When they last wrote, ISO 8601. */
    readonly lastMessageAt: string
}

/** Why the test send is closed, or null when it is open. */
export type ZaloSendBlock = "not_authorized" | "token_expired" | "no_recipient"

/** The page of one Zalo OA connection; every secret is masked to its last four characters. */
export interface ZaloPageView {
    /** The connection id. */
    readonly id: string
    /** The OA name the owner gave. */
    readonly name: string
    /** The status of the connection. */
    readonly status: string
    /** True when the connection works and needs no attention. */
    readonly healthy: boolean
    /** The Official Account id, or an empty text. */
    readonly oaId: string
    /** The Zalo app id. */
    readonly appId: string
    /** The app secret masked to its last four characters, or null when none is saved. */
    readonly appSecretMask: string | null
    /** The OA Secret Key masked to its last four characters, or null when none is saved. */
    readonly oaSecretMask: string | null
    /** The Official Account callback address to paste into Zalo. */
    readonly callbackUrl: string
    /** The webhook address to paste into Zalo. */
    readonly webhookUrl: string
    /** The access token. */
    readonly access: ZaloAccessView
    /** The rows of the check list. */
    readonly checks: ReadonlyArray<ZaloCheckRow>
    /** The followers a test message can go to. */
    readonly recipients: ReadonlyArray<ZaloRecipient>
    /** Why the test send is closed, or null. */
    readonly sendBlock: ZaloSendBlock | null
    /** The agents that use the connection. */
    readonly agentIds: ReadonlyArray<string>
}

/** The kinds of line the live panel lists. */
export type ZaloEventKind = "user_send_text" | "follow" | "agent_reply" | "renewal_qr"

/** What happened to the event. */
export type ZaloEventOutcome = "received" | "sent" | "not_sent"

/** One line of the live Zalo events panel. */
export interface ZaloPageEvent {
    /** A stable id of the line. */
    readonly id: string
    /** The kind. */
    readonly kind: ZaloEventKind
    /** What happened to it. */
    readonly outcome: ZaloEventOutcome
    /** When, ISO 8601. */
    readonly at: string
    /** The customer, when known. */
    readonly who: string
    /** A short excerpt of the text. */
    readonly text: string
    /** Why a reply was not sent, in the stable terms of the delivery path; null otherwise. */
    readonly reason: string | null
}

/** What a test send answers. */
export interface ZaloTestSendResult {
    /** True when Zalo accepted the message. */
    readonly sent: boolean
    /** Why it did not go out, or null. */
    readonly failure: string | null
}
