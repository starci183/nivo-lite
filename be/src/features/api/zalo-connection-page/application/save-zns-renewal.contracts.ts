import type { ZnsRenewalSettings } from "@modules/domain/channels"

/** What saveZnsRenewal takes. */
export interface SaveZnsRenewalRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The Zalo connection. */
    readonly connectionId: string
    /** The template id and the parameter names; an empty template id turns the fallback off. */
    readonly settings: ZnsRenewalSettings
}
