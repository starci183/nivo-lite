import type { ContentAutomationKey } from "@modules/domain/content-settings"

/** Arguments of setContentAutomation. */
export interface SetContentAutomationRequest {
    /** The selected workspace; the service proves membership. */
    readonly workspaceId: string
    /** Configuration to save. */
    readonly key: ContentAutomationKey
    /** Whether the automation is enabled. */
    readonly on: boolean
}
