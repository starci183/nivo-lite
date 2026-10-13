import type { SaveAvailabilityParams } from "@modules/domain/hiring"

/** What replace the weekly free times of a member takes. */
export interface SaveHiringAvailabilityRequest extends SaveAvailabilityParams {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
}
