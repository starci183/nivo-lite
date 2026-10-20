import type { Locale } from "@modules/platform/i18n"

/** What listing the Hub rooms takes. */
export interface ListOfficeRoomsRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
}

/** What opening the department rooms takes. */
export interface SetupOfficeRoomsRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves they own or manage it. */
    readonly workspaceId: string
    /** The language of the note NIVO posts when the rooms open. */
    readonly locale: Locale
}
