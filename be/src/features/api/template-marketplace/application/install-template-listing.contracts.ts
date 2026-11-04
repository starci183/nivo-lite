import type { Locale } from "@modules/platform/i18n"

/** What the InstallTemplateListing operation takes. */
export interface InstallTemplateListingRequest {
    /** The workspace of the buyer. */
    readonly workspaceId: string
    /** The listing. */
    readonly listingId: string
    /** The values of the parameters, by key. */
    readonly values: object
    /** The label of the agent, when the buyer gave one. */
    readonly name?: string | undefined
    /** The language of the request. */
    readonly locale: Locale
}
