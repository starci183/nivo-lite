import type { Locale } from "@modules/platform/i18n"

/** The bounded application request for takes over a customer conversation or releases it to the ai. */
export interface SetChatHandlingRequest {
    /** The workspace selector; the domain service proves membership. */
    readonly workspaceId: string
    /** The conversation id. */
    readonly conversationId: string
    /** True to hold the conversation, false to release it. */
    readonly takeOver: boolean
    /** The language of audit lines. */
    readonly locale: Locale
}
