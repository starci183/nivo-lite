import type { Locale } from "@modules/platform/i18n"

/** What the ReadMentionDirectory operation takes. */
export interface ReadMentionDirectoryRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The language of the group names. */
    readonly locale: Locale
}
