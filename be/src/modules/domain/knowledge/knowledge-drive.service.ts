import { Injectable } from "@nestjs/common"
import { DocumentsError, DocumentsErrorCode, InjectDocuments } from "@modules/integrations/documents"
import type { DocumentsPort, DriveFolderListing } from "@modules/integrations/documents"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceRole } from "@modules/domain/workspace-members"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { InjectDriveAccessSource } from "./knowledge.decorators"
import type { DriveAccessSource, PickedFolder } from "./knowledge.contracts"
import { KnowledgeLogEvent } from "./knowledge.log-events"
import { isPickerToken } from "./picker-token.policy"

/** Who may list the Drive of a workspace for its knowledge. */
const MANAGERS: ReadonlyArray<WorkspaceRole> = ["owner", "manager"]

/** The statuses Google answers for a folder the picked token cannot list. */
const NOT_LISTABLE: ReadonlyArray<number> = [403, 404]

@Injectable()
/** The Google Drive folders an owner adds to the knowledge: a pasted folder link read with the workspace grant, or a folder picked in the Google Picker. */
export class KnowledgeDriveService {
    constructor(
        @InjectDriveAccessSource() private readonly driveAccess: DriveAccessSource,
        @InjectDocuments() private readonly documents: DocumentsPort,
        @InjectLogger() private readonly logger: Logger,
        private readonly members: WorkspaceMembersService,
    ) {}

    /** The files of a pasted Drive folder link (the folder and three levels below it), read with the Drive access the workspace gave. */
    async listLinkedFolder(userId: string, workspaceId: string, url: string): Promise<DriveFolderListing> {
        await this.members.require(userId, workspaceId, MANAGERS)
        const folderId = this.documents.driveFolderOf(url)
        if (folderId === null) throw new DocumentsError({ code: DocumentsErrorCode.NotFolder })
        const drive = this.driveAccess.forWorkspace(workspaceId)
        if (drive === null) throw new DocumentsError({ code: DocumentsErrorCode.DriveGrantMissing })
        return drive.withToken((token) => this.documents.listDriveFolder(token, folderId))
    }

    /**
     * The files of a folder picked in the Google Picker, listed with the short-lived token the browser holds. The token is used for this
     * call only; it is never stored or logged. A folder the token cannot list comes back empty, for the owner to pick the files inside.
     */
    async listPickedFolder(
        userId: string,
        workspaceId: string,
        folderId: string,
        token: string,
    ): Promise<PickedFolder> {
        await this.members.require(userId, workspaceId, MANAGERS)
        if (!isPickerToken(token)) throw new DocumentsError({ code: DocumentsErrorCode.TokenRejected })
        try {
            const listing = await this.documents.listDriveFolder(token, folderId)
            return { ...listing, empty: listing.files.length === 0 }
        } catch (cause) {
            const status = cause instanceof DocumentsError ? Number(cause.params.status) : 0
            if (!NOT_LISTABLE.includes(status)) throw cause
            this.logger.warn(KnowledgeLogEvent.PickedFolderRefused, { workspaceId, status })
            return { name: "", files: [], truncated: false, empty: true }
        }
    }
}
