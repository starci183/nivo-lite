import type { RequestOfferParams } from "@modules/domain/hiring"

/** What draft an offer for a candidate and ask for approval takes. */
export interface RequestHiringOfferRequest extends RequestOfferParams {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
}
