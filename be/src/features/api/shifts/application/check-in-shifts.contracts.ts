import type { CheckInParams } from "@modules/domain/shifts"

/** What check in to the caller's shift takes. */
export interface CheckInShiftsRequest extends CheckInParams {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
}
