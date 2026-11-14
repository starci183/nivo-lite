import { Injectable } from "@nestjs/common"
import type { ConnectionRecord } from "@modules/domain/connections"
import { InjectDocuments, type DocumentsPort } from "@modules/integrations/documents"
import { DriveGrantService } from "./drive-grant.service"
import type { DriveFileRead, DriveFolderListing, DriveGrantState, DriveReachPort } from "./drive-reach.port"

@Injectable()
/**
 * The LIVE Google Drive port: the grant of the workspace (`DriveGrantService.forWorkspace`: the live grant connection, its token
 * refreshed and retried once on a 401) against Drive through the documents integration. Nothing of its own: every failure is the
 * integration's `DocumentsError`, the family the sandbox twin throws.
 */
export class DriveLiveReachService implements DriveReachPort {
    /** The provider key. */
    readonly provider = "google_drive" as const

    constructor(
        private readonly grants: DriveGrantService,
        @InjectDocuments() private readonly documents: DocumentsPort,
    ) {}

    /** Where the workspace grant stands. */
    async grant(connection: ConnectionRecord): Promise<DriveGrantState> {
        return await this.grants.forWorkspace(connection.workspaceId).state()
    }

    /** The files of a Drive folder, read with the grant token. */
    async listFolder(connection: ConnectionRecord, folderId: string): Promise<DriveFolderListing> {
        return await this.grants
            .forWorkspace(connection.workspaceId)
            .withToken((token) => this.documents.listDriveFolder(token, folderId))
    }

    /** The text of one Drive file, read with the grant token. */
    async readFile(connection: ConnectionRecord, fileId: string): Promise<DriveFileRead> {
        return await this.grants
            .forWorkspace(connection.workspaceId)
            .withToken((token) => this.documents.readDriveFile(token, fileId))
    }
}
