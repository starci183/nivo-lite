import type { WorkspaceLogoUpload, WorkspaceSettings } from "@modules/domain/workspace-settings"
import type { RequestWorkspaceLogoUploadRequest } from "../../application/request-workspace-logo-upload.contracts"
import type { UpdateWorkspaceSettingsRequest } from "../../application/update-workspace-settings.contracts"
import type { RequestWorkspaceLogoUploadInput } from "./dto/request-workspace-logo-upload.input"
import type { UpdateWorkspaceSettingsInput } from "./dto/update-workspace-settings.input"
import type { WorkspaceLogoUploadType } from "./dto/workspace-logo-upload.type"
import type { WorkspaceSettingsType } from "./dto/workspace-settings.type"

/** Maps the changes a manager sends to the update request; a member the input leaves out is left out of the edit. */
export const toUpdateWorkspaceSettingsRequest = (
    workspaceId: string,
    input: UpdateWorkspaceSettingsInput,
): UpdateWorkspaceSettingsRequest => ({
    workspaceId,
    edit: {
        ...(input.name === undefined ? {} : { name: input.name }),
        ...(input.timeZone === undefined ? {} : { timeZone: input.timeZone }),
        ...(input.logoPath === undefined ? {} : { logoPath: input.logoPath }),
    },
})

/** Maps the logo a manager wants to upload to the upload request. */
export const toRequestWorkspaceLogoUploadRequest = (
    workspaceId: string,
    input: RequestWorkspaceLogoUploadInput,
): RequestWorkspaceLogoUploadRequest => ({
    workspaceId,
    contentType: input.contentType,
    sizeBytes: input.sizeBytes,
})

/** Maps the settings to their GraphQL type. */
export const toWorkspaceSettingsType = (settings: WorkspaceSettings): WorkspaceSettingsType => ({
    name: settings.name,
    timeZone: settings.timeZone,
    logoUrl: settings.logoUrl,
})

/** Maps the upload address to its GraphQL type. */
export const toWorkspaceLogoUploadType = (upload: WorkspaceLogoUpload): WorkspaceLogoUploadType => ({
    path: upload.path,
    token: upload.token,
    signedUrl: upload.signedUrl,
    publicUrl: upload.publicUrl,
})
