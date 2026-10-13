import type { Locale } from "@modules/platform/i18n"

/** What confirming a command card takes. */
export interface ConfirmCommandRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The command card. */
    readonly candidateId: string
    /** The language the receiving Office line is written in. */
    readonly locale: Locale
}
