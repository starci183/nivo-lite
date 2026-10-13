import type { CancelOfferParams } from "@modules/domain/hiring"

/** What cancel an offer takes. */
export interface CancelHiringOfferRequest extends CancelOfferParams {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
}
