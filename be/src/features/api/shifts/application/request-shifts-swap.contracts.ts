import type { RequestSwapParams } from "@modules/domain/shifts"

/** What hand a shift over or take an open one takes. */
export interface RequestShiftsSwapRequest extends RequestSwapParams {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
}
