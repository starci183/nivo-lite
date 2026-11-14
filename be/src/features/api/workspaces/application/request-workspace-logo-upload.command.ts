import { Command } from "@nestjs/cqrs"
import type { WorkspaceLogoUpload } from "@modules/domain/workspace-settings"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { RequestWorkspaceLogoUploadRequest } from "./request-workspace-logo-upload.contracts"

/** Asks for a one-time address to upload the workspace logo to. */
export class RequestWorkspaceLogoUploadCommand extends Command<WorkspaceLogoUpload> {
    constructor(readonly params: ExecuteParams<RequestWorkspaceLogoUploadRequest>) {
        super()
    }
}
