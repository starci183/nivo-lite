import type { Locale } from "@modules/platform/i18n"

/** What posting a message in the setup chat takes. */
export interface PostSetupMessageRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The open draft. */
    readonly setupSessionId: string
    /** The message. */
    readonly text: string
    /** The language of the names and the generated text. */
    readonly locale: Locale
}
