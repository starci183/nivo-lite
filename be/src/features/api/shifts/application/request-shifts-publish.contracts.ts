import type { RequestPublishParams } from "@modules/domain/shifts"

/** What put a draft schedule before the owner to publish takes. */
export interface RequestShiftsPublishRequest extends RequestPublishParams {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
}
