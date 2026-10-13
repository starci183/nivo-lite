import type { LinkStaffParams } from "@modules/domain/hiring"

/** What create a staff profile from a hired candidate takes. */
export interface LinkHiringStaffRequest extends LinkStaffParams {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
}
