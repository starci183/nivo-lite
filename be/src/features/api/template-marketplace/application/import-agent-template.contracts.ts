import type { Locale } from "@modules/platform/i18n"

/** What the ImportAgentTemplate operation takes. */
export interface ImportAgentTemplateRequest {
    /** The workspaceId. */
    readonly workspaceId: string
    /** The templateKey. */
    readonly templateKey: string
    /** The version. */
    readonly version: number
    /** The values of the parameters, by key. */
    readonly values: object
    /** The name, when the buyer gave one. */
    readonly name?: string | undefined
    /** The language of the request. */
    readonly locale: Locale
}
