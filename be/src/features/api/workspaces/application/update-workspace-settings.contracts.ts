import type { WorkspaceSettingsRequestedEdit } from "@modules/domain/workspace-settings"

/** What changing the settings of the active workspace takes. */
export interface UpdateWorkspaceSettingsRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves they own or manage it. */
    readonly workspaceId: string
    /** The members to change; one left out stays as it is. */
    readonly edit: WorkspaceSettingsRequestedEdit
}
