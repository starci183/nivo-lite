import type { Locale } from "@modules/platform/i18n"

/** What proposing a command takes. */
export interface ProposeCommandRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The owner message, already stored in the Office thread. */
    readonly messageId: string
    /** The language of the card and the replies. */
    readonly locale: Locale
}
