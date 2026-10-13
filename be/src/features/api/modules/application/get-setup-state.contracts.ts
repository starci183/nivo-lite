import type { Locale } from "@modules/platform/i18n"

/** What reading the Setup tab of an agent takes. */
export interface GetSetupStateRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The installation. */
    readonly installationId: string
    /** The language of the names and the generated text. */
    readonly locale: Locale
}
