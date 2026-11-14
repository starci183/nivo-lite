import type { CrmAuthDraft } from "@modules/domain/data-hub"

/** What saveCrmConnection takes. */
export interface SaveCrmConnectionRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The connection to update; null or absent creates one. */
    readonly connectionId?: string | null | undefined
    /** The CRM id: a package's template or the shop's own. */
    readonly crmId: string
    /** The API base URL. */
    readonly baseUrl: string
    /** Where the live OpenAPI document is; only for a CRM no package declares. */
    readonly swaggerUrl?: string | null | undefined
    /** The key as typed; a blank value keeps the stored one. */
    readonly auth: CrmAuthDraft
}
