import type { SetItemActiveParams } from "@modules/domain/inventory"

/** What switch a catalogue item on or off takes. */
export interface SetInventoryItemActiveRequest extends SetItemActiveParams {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
}
